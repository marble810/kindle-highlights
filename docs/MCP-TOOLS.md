# MCP Tools

## Region Policy

`login` and `check_login_status` keep an optional `region` parameter for compatibility, but only accept `co.jp`.

## login

Input:

```ts
{ region?: "co.jp" }
```

Behavior:

- Opens browser for manual Amazon sign-in.
- Returns `browser_opened`, `already_opened`, or `failed`.

## check_login_status

Input:

```ts
{ region?: "co.jp" }
```

Behavior:

- Checks main-site login and Web Reader readiness.
- Returns `ready`, `main_only`, `needs_login`, or `failed`.

## get_book_list

Input:

```ts
{}
```

Behavior:

- Reads books from `read.amazon.co.jp/notebook`.
- May run one automated visible-browser repair flow if direct read is not ready.

## fetch_notes

Input:

```ts
{ asin: string }
```

Behavior:

- Fetches highlights and notes for one book.
