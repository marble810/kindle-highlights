#!/usr/bin/env node
/**
 * Kindle MCP Server
 * MCP Server for scraping Kindle highlights and notes from read.amazon.com
 * Phase 4: MCP Server Implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { scrapeKindleNotes, launchLoginSession, getBookList, fetchBookHighlights, getLoginInstructions } from './browser.js';
import type { KindleBookData, ScrapingResult, AmazonRegion } from './types.js';

/**
 * Amazon region configuration
 */
const REGIONS: Record<string, { name: string; url: string }> = {
  'com': { name: 'United States', url: 'https://www.amazon.com' },
  'co.jp': { name: 'Japan', url: 'https://www.amazon.co.jp' },
  'co.uk': { name: 'United Kingdom', url: 'https://www.amazon.co.uk' },
  'de': { name: 'Germany', url: 'https://www.amazon.de' },
  'fr': { name: 'France', url: 'https://www.amazon.fr' },
  'es': { name: 'Spain', url: 'https://www.amazon.es' },
  'it': { name: 'Italy', url: 'https://www.amazon.it' },
  'ca': { name: 'Canada', url: 'https://www.amazon.ca' },
  'com.au': { name: 'Australia', url: 'https://www.amazon.com.au' },
  'in': { name: 'India', url: 'https://www.amazon.in' },
  'com.mx': { name: 'Mexico', url: 'https://www.amazon.com.mx' },
};

const DEFAULT_REGION: AmazonRegion = 'com';

/**
 * Parse command line arguments
 */
interface CliArgs {
  login: boolean;
  region: AmazonRegion | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const result: CliArgs = {
    login: false,
    region: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--login') {
      result.login = true;
    } else if (arg === '--region') {
      // Get next argument as region value (space-separated format)
      const regionCode = args[++i] as AmazonRegion;
      if (regionCode && REGIONS[regionCode]) {
        result.region = regionCode;
      } else {
        console.error(`Invalid region: ${regionCode}`);
        console.error('Valid regions: ' + Object.keys(REGIONS).join(', '));
        process.exit(1);
      }
    } else if (arg.startsWith('--region=')) {
      // Handle equals format: --region=co.jp
      const regionCode = arg.split('=')[1] as AmazonRegion;
      if (REGIONS[regionCode]) {
        result.region = regionCode;
      } else {
        console.error(`Invalid region: ${regionCode}`);
        console.error('Valid regions: ' + Object.keys(REGIONS).join(', '));
        process.exit(1);
      }
    }
  }

  return result;
}

/**
 * Get region code with fallback
 */
function getRegion(argRegion: AmazonRegion | null): AmazonRegion {
  return argRegion || DEFAULT_REGION;
}

/**
 * Validate Amazon region
 */
function isValidRegion(region: string): region is AmazonRegion {
  const validRegions: AmazonRegion[] = ['com', 'co.jp', 'co.uk', 'de', 'fr', 'es', 'it', 'ca', 'com.au', 'in', 'com.mx'];
  return validRegions.includes(region as AmazonRegion);
}

/**
 * Create and configure MCP Server
 */
function createServer(region: AmazonRegion): Server {
  const server = new Server(
    {
      name: 'kindle-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_book_list',
          description: 'Get list of all books with highlights from Kindle Notebook. Returns book titles and authors for user to select.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'fetch_notes',
          description: 'Fetch Kindle highlights and notes for a specific book. Use ASIN from get_book_list to specify which book.',
          inputSchema: {
            type: 'object',
            properties: {
              asin: {
                type: 'string',
                description: 'Amazon ASIN of the book to fetch (get from get_book_list)',
              },
            },
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'get_book_list': {
          console.error(`[MCP] Getting book list from region: ${region}...`);

          // Get book list
          const result = await getBookList(region);

          if (!result.success) {
            // 提供友好的错误提示
            const errorMessage = result.error || 'Unknown error';
            if (errorMessage.includes('Session expired') || errorMessage.includes('not logged in')) {
              return {
                content: [
                  {
                    type: 'text',
                    text: getLoginInstructions(region),
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }

          // Format and return results
          const books = result.data!;
          console.error(`[MCP] Found ${books.length} books`);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(books, null, 2),
              },
            ],
          };
        }

        case 'fetch_notes': {
          const asin = typeof args?.asin === 'string' ? args.asin : null;

          if (!asin) {
            return {
              content: [
                {
                  type: 'text',
                  text: 'Error: ASIN parameter is required. Use get_book_list first to get available books.',
                },
              ],
              isError: true,
            };
          }

          console.error(`[MCP] Fetching notes for ASIN: ${asin} from region: ${region}...`);

          // Fetch highlights for specific book
          const result = await fetchBookHighlights(asin, region);

          if (!result.success) {
            // 提供友好的错误提示
            const errorMessage = result.error || 'Unknown error';
            if (errorMessage.includes('Session expired') || errorMessage.includes('not logged in')) {
              return {
                content: [
                  {
                    type: 'text',
                    text: getLoginInstructions(region),
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }

          // Format and return results
          const book = result.data!;
          console.error(`[MCP] Found ${book.highlights.length} highlights`);

          const formattedData = {
            title: book.title,
            author: book.author,
            highlights: book.highlights.map((h) => ({
              text: h.text,
              note: h.note,
              color: h.color,
              location: h.location,
            })),
          };

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(formattedData, null, 2),
              },
            ],
          };
        }

        default:
          return {
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`,
              },
            ],
            isError: true,
          };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Parse command line arguments
  const cliArgs = parseArgs();
  const region = getRegion(cliArgs.region);

  // Handle --login flag
  if (cliArgs.login) {
    const regionInfo = REGIONS[region];
    console.error(`[MCP] Login mode for Amazon ${region} (${regionInfo.name})`);
    await launchLoginSession(region);
    process.exit(0);
  }

  // Show region info
  const regionInfo = REGIONS[region];
  console.error(`[MCP] Using Amazon region: ${region} (${regionInfo.name})`);
  console.error(`[MCP] Sign-in URL: ${regionInfo.url}/login`);
  console.error(`[MCP] Notebook URL: ${regionInfo.url.replace('www.amazon', 'read.amazon')}/notebook`);

  // Create and start MCP server
  const server = createServer(region);
  const transport = new StdioServerTransport();

  console.error('[MCP] Starting Kindle MCP Server...');

  await server.connect(transport);

  console.error('[MCP] Server started and ready to accept connections');
  console.error(`[MCP] Region: ${region} (${regionInfo.name})`);
  console.error('[MCP] To change region: npm run start:<region> (e.g., start:jp)');
}

// Run main function
main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
