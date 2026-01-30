# moodle-ts

Type-safe TypeScript SDK for Moodle Web Services API with auto-generated types.

## Features

- **Type-safe** - Full TypeScript support with generated types for all Moodle Web Service functions
- **Auto-generated** - Types are automatically generated from Moodle source code
- **Versioned** - Support multiple Moodle versions via subpath imports
- **Modern** - ESM-first, works with Node.js 18+
- **Lightweight** - Zero runtime dependencies

## Installation

```bash
npm install moodle-ts
```

## Quick Start

```typescript
import { MoodleClient } from "moodle-ts";

const client = new MoodleClient({
  baseUrl: "https://moodle.example.com",
  token: "your-webservice-token",
});

// Get site info
const { data: siteInfo } = await client.getSiteInfo();
console.log(`Connected to ${siteInfo.sitename} (${siteInfo.release})`);

// Make typed API calls
const { data: courses } = await client.call("core_course_get_courses", {
  options: { ids: [1, 2, 3] },
});
```

## Using Versioned Types

For full type safety, import typed function wrappers from a specific Moodle version:

```typescript
import { MoodleClient } from "moodle-ts";
import {
  core_course_get_courses,
  core_user_get_users,
  mod_assign_get_assignments,
} from "moodle-ts/moodle/MOODLE_405_STABLE";

const client = new MoodleClient({
  baseUrl: "https://moodle.example.com",
  token: "your-token",
});

// Fully typed - params and return types are inferred
const { data: courses } = await core_course_get_courses(client, {
  options: { ids: [1, 2, 3] },
});

const { data: users } = await core_user_get_users(client, {
  criteria: [{ key: "email", value: "student@example.com" }],
});

const { data: assignments } = await mod_assign_get_assignments(client, {
  courseids: [1],
});
```

## Supported Moodle Versions

| Version | Import Path |
|---------|-------------|
| Moodle 4.5.x | `moodle-ts/moodle/MOODLE_405_STABLE` |
| Moodle 5.0.x | `moodle-ts/moodle/MOODLE_500_STABLE` |

## Error Handling

```typescript
import {
  MoodleClient,
  MoodleApiError,
  MoodleNetworkError,
} from "moodle-ts";

try {
  const { data } = await client.call("core_course_get_courses", {});
} catch (error) {
  if (error instanceof MoodleApiError) {
    console.error(`API Error: ${error.message} (${error.errorCode})`);
  } else if (error instanceof MoodleNetworkError) {
    console.error(`Network Error: ${error.message}`);
  }
}
```

## Configuration Options

```typescript
const client = new MoodleClient({
  // Required
  baseUrl: "https://moodle.example.com",
  token: "your-webservice-token",

  // Optional
  timeout: 30000, // Request timeout in ms (default: 30000)
  fetch: customFetch, // Custom fetch implementation
});
```

## Obtaining a Token

To use this SDK, you need a Moodle Web Service token:

1. Go to **Site administration > Plugins > Web services > Manage tokens**
2. Click "Create token"
3. Select the user and service
4. Copy the generated token

Make sure the Web Services are enabled and the user has appropriate capabilities.

## How Type Generation Works

Types are automatically generated from Moodle's source code using a CI workflow:

1. **Schema Extraction**: A PHP script runs inside each supported Moodle version to extract function metadata using Moodle's `external_api` introspection
2. **Code Generation**: A Node.js script converts the JSON schemas into TypeScript types and typed function wrappers
3. **OpenAPI Generation**: An OpenAPI 3.1 spec is also generated for use with other tools
4. **Automated PRs**: Changes are submitted as pull requests for review

To regenerate types manually:

```bash
# After placing schema JSON files in schemas/
npm run codegen
npm run build
```

## OpenAPI

This project also generates OpenAPI 3.1 specs that can be used with other code generators.

```bash
# Generate OpenAPI specs
npm run openapi

# Files are output to:
#   openapi/MOODLE_405_STABLE.json
#   openapi/MOODLE_405_STABLE.yaml
```

## Development

```bash
# Install dependencies
npm install

# Build the package
npm run build

# Type check
npm run typecheck

# Generate OpenAPI specs
npm run openapi

# Run code generation
npm run codegen
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
