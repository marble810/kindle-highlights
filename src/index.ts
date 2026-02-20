#!/usr/bin/env node
/**
 * Kindle MCP Server
 * MCP Server for scraping Kindle highlights and notes from read.amazon.co.jp
 * Phase 4: MCP Server Implementation
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { scrapeKindleNotes, launchLoginSession, getBookList, fetchBookHighlights, getLoginInstructions, launchLoginForMCP, checkLoginStatus } from './browser.js';
import type { KindleBookData, ScrapingResult, AmazonRegion, LoginToolResult } from './types.js';
import {
  getRegionConfig,
  REGIONS,
  isValidRegion,
  getValidRegions,
  formatRegionConfig,
  type RegionConfig
} from './config.js';

/**
 * Parse command line arguments
 */
interface CliArgs {
  login: boolean;
  region: string | null;
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
      const regionCode = args[++i];
      if (regionCode && isValidRegion(regionCode)) {
        result.region = regionCode;
      } else {
        console.error(`Invalid region: ${regionCode}`);
        console.error('Valid regions: ' + getValidRegions().join(', '));
        process.exit(1);
      }
    } else if (arg.startsWith('--region=')) {
      // Handle equals format: --region=co.jp
      const regionCode = arg.split('=')[1];
      if (regionCode && isValidRegion(regionCode)) {
        result.region = regionCode;
      } else {
        console.error(`Invalid region: ${regionCode}`);
        console.error('Valid regions: ' + getValidRegions().join(', '));
        process.exit(1);
      }
    }
  }

  return result;
}

/**
 * Create and configure MCP Server
 */
function createServer(region: AmazonRegion): Server {
  const server = new Server(
    {
      name: 'kindle-annotations-mcp',
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
          name: 'login',
          description: 'Open a browser for manual Amazon sign-in only. This tool does not auto-detect success or auto-close. After signing in, call check_login_status to verify readiness.',
          inputSchema: {
            type: 'object',
            properties: {
              region: {
                type: 'string',
                description: 'Amazon region code (e.g., "co.jp" for Japan). Defaults to the server configured region.',
                enum: getValidRegions(),
              },
            },
          },
        },
        {
          name: 'check_login_status',
          description: 'Check whether Amazon main-site login and Kindle Web Reader session are ready.',
          inputSchema: {
            type: 'object',
            properties: {
              region: {
                type: 'string',
                description: 'Amazon region code (e.g., "co.jp" for Japan). Defaults to the server configured region.',
                enum: getValidRegions(),
              },
            },
          },
        },
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
    const requestedRegion = typeof args?.region === 'string' ? args.region : undefined;

    try {
      switch (name) {
        case 'login': {
          if (requestedRegion && !isValidRegion(requestedRegion)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Unsupported region "${requestedRegion}". Only "co.jp" is supported.`,
                },
              ],
              isError: true,
            };
          }

          const loginRegion = typeof args?.region === 'string' && isValidRegion(args.region)
            ? args.region as AmazonRegion
            : region;

          console.error(`[MCP] Login requested for region: ${loginRegion}`);

          const result = await launchLoginForMCP(loginRegion);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'check_login_status': {
          if (requestedRegion && !isValidRegion(requestedRegion)) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: Unsupported region "${requestedRegion}". Only "co.jp" is supported.`,
                },
              ],
              isError: true,
            };
          }

          const statusRegion = typeof args?.region === 'string' && isValidRegion(args.region)
            ? args.region as AmazonRegion
            : region;

          console.error(`[MCP] Checking login status for region: ${statusRegion}`);

          const result = await checkLoginStatus(statusRegion);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
            isError: !result.success,
          };
        }

        case 'get_book_list': {
          console.error(`[MCP] Getting book list from region: ${region}...`);

          // Get book list
          const result = await getBookList(region);

          if (!result.success) {
            const errorMessage = result.error || 'Unknown error';

            if (errorMessage.includes('Session expired') || errorMessage.includes('not logged in')) {
              // Return structured error, prompt user to use login tool
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      error: 'SESSION_EXPIRED',
                      message: 'Your Amazon session has expired.',
                      region: region,
                      actionRequired: 'Please use "login" for manual sign in, then call "check_login_status" to verify.',
                    }, null, 2),
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
            const errorMessage = result.error || 'Unknown error';

            if (errorMessage.includes('Session expired') || errorMessage.includes('not logged in')) {
              // Return structured error, prompt user to use login tool
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      error: 'SESSION_EXPIRED',
                      message: 'Your Amazon session has expired.',
                      region: region,
                      actionRequired: 'Please use "login" for manual sign in, then call "check_login_status" to verify.',
                    }, null, 2),
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

  // Get region configuration with three-tier priority
  const regionConfig = getRegionConfig(cliArgs.region);
  const region = regionConfig.region;
  const regionInfo = REGIONS[region];

  // Show region configuration source
  console.error(`[MCP] Region configuration: ${formatRegionConfig(regionConfig)}`);
  console.error(`[MCP] Sign-in URL: ${regionInfo.url}/login`);
  console.error(`[MCP] Notebook URL: ${regionInfo.url.replace('www.amazon', 'read.amazon')}/notebook`);

  // Handle --login flag
  if (cliArgs.login) {
    console.error(`[MCP] Login mode for Amazon ${region} (${regionInfo.name})`);
    await launchLoginSession(region);
    process.exit(0);
  }

  // Create and start MCP server
  const server = createServer(region);
  const transport = new StdioServerTransport();

  console.error('[MCP] Starting Kindle MCP Server...');

  await server.connect(transport);

  console.error('[MCP] Server started and ready to accept connections');
  console.error(`[MCP] Region: ${region} (${regionInfo.name})`);
}

// Run main function
main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
