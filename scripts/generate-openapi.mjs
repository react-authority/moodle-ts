#!/usr/bin/env node
/**
 * OpenAPI Schema Generator for Moodle Web Services
 *
 * Converts Moodle schema JSON to OpenAPI 3.1 format for use with
 * other code generators.
 *
 * Usage:
 *   node scripts/generate-openapi.mjs [schemaFile]
 *
 * If no schema file is provided, processes all JSON files in the schemas/ directory.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const SCHEMAS_DIR = join(ROOT_DIR, "schemas");
const OPENAPI_DIR = join(ROOT_DIR, "openapi");

/**
 * Convert a Moodle schema type to OpenAPI schema
 */
function moodleTypeToOpenAPI(schema, components, prefix = "") {
  if (!schema) {
    return { type: "object", additionalProperties: true };
  }

  switch (schema.type) {
    case "integer":
      return {
        type: "integer",
        ...(schema.description && { description: schema.description }),
        ...(schema.default !== undefined && { default: schema.default }),
        ...(schema.nullable && { nullable: true }),
      };

    case "number":
      return {
        type: "number",
        ...(schema.description && { description: schema.description }),
        ...(schema.default !== undefined && { default: schema.default }),
        ...(schema.nullable && { nullable: true }),
      };

    case "boolean":
      return {
        type: "boolean",
        ...(schema.description && { description: schema.description }),
        ...(schema.default !== undefined && { default: schema.default }),
      };

    case "string":
      return {
        type: "string",
        ...(schema.description && { description: schema.description }),
        ...(schema.default !== undefined && { default: schema.default }),
        ...(schema.nullable && { nullable: true }),
      };

    case "array": {
      const items = schema.items
        ? moodleTypeToOpenAPI(schema.items, components, prefix)
        : { type: "object", additionalProperties: true };
      return {
        type: "array",
        items,
        ...(schema.description && { description: schema.description }),
      };
    }

    case "object": {
      if (!schema.properties || Object.keys(schema.properties).length === 0) {
        return {
          type: "object",
          additionalProperties: true,
          ...(schema.description && { description: schema.description }),
        };
      }

      const properties = {};
      const required = [];

      for (const [key, value] of Object.entries(schema.properties)) {
        properties[key] = moodleTypeToOpenAPI(value, components, `${prefix}_${key}`);

        // Determine if required
        if (schema.required?.includes(key) || value.required === true) {
          required.push(key);
        }
      }

      return {
        type: "object",
        properties,
        ...(required.length > 0 && { required }),
        ...(schema.description && { description: schema.description }),
      };
    }

    default:
      return { type: "object", additionalProperties: true };
  }
}

/**
 * Convert function name to PascalCase for schema names
 */
function toPascalCase(str) {
  return str
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

/**
 * Generate OpenAPI spec from a Moodle schema
 */
function generateOpenAPISpec(schema, schemaName) {
  const components = { schemas: {} };

  // Build paths and schemas for each function
  const paths = {};

  for (const func of schema.functions || []) {
    const operationId = func.name;
    const pascalName = toPascalCase(func.name);
    const requestSchemaName = `${pascalName}Request`;
    const responseSchemaName = `${pascalName}Response`;

    // Generate request schema
    if (func.parameters) {
      components.schemas[requestSchemaName] = moodleTypeToOpenAPI(
        func.parameters,
        components,
        requestSchemaName
      );
    } else {
      components.schemas[requestSchemaName] = {
        type: "object",
        properties: {},
      };
    }

    // Generate response schema
    if (func.returns) {
      components.schemas[responseSchemaName] = moodleTypeToOpenAPI(
        func.returns,
        components,
        responseSchemaName
      );
    } else {
      components.schemas[responseSchemaName] = {
        type: "object",
        nullable: true,
      };
    }

    // Create path for this function
    // Moodle uses a single endpoint with wsfunction parameter, but for OpenAPI
    // we model each function as a separate path for better code generation
    const path = `/webservice/rest/${func.name}`;

    paths[path] = {
      post: {
        operationId,
        summary: func.description || `Call ${func.name}`,
        description: func.description || undefined,
        tags: [getTagFromFunctionName(func.name)],
        ...(func.capabilities && {
          "x-moodle-capabilities": func.capabilities,
        }),
        ...(func.ajax !== undefined && { "x-moodle-ajax": func.ajax }),
        ...(func.loginrequired !== undefined && {
          "x-moodle-login-required": func.loginrequired,
        }),
        requestBody: {
          required: true,
          content: {
            "application/x-www-form-urlencoded": {
              schema: { $ref: `#/components/schemas/${requestSchemaName}` },
            },
          },
        },
        responses: {
          200: {
            description: "Successful response",
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${responseSchemaName}` },
              },
            },
          },
          400: {
            description: "Bad request - invalid parameters",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MoodleError" },
              },
            },
          },
          401: {
            description: "Unauthorized - invalid or missing token",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MoodleError" },
              },
            },
          },
        },
        security: [{ wstoken: [] }],
      },
    };
  }

  // Add common error schema
  components.schemas.MoodleError = {
    type: "object",
    properties: {
      exception: {
        type: "string",
        description: "The exception class name",
      },
      errorcode: {
        type: "string",
        description: "The error code",
      },
      message: {
        type: "string",
        description: "Human-readable error message",
      },
      debuginfo: {
        type: "string",
        description: "Debug information (only in development mode)",
      },
    },
    required: ["message"],
  };

  // Add warning schema used by many endpoints
  components.schemas.MoodleWarning = {
    type: "object",
    properties: {
      item: {
        type: "string",
        description: "Item that triggered the warning",
      },
      itemid: {
        type: "integer",
        description: "ID of the item",
      },
      warningcode: {
        type: "string",
        description: "Warning code",
      },
      message: {
        type: "string",
        description: "Warning message",
      },
    },
    required: ["warningcode", "message"],
  };

  // Build the full OpenAPI spec
  const openapi = {
    openapi: "3.1.0",
    info: {
      title: "Moodle Web Services API",
      version: schema.moodleVersion || "unknown",
      description: `Auto-generated OpenAPI specification for Moodle Web Services.\n\nMoodle Release: ${schema.moodleRelease || "unknown"}\nGenerated: ${new Date().toISOString()}`,
      contact: {
        name: "Moodle",
        url: "https://moodle.org",
      },
      license: {
        name: "GPL-3.0",
        url: "https://www.gnu.org/licenses/gpl-3.0.html",
      },
    },
    servers: [
      {
        url: "{baseUrl}",
        description: "Moodle instance",
        variables: {
          baseUrl: {
            default: "https://moodle.example.com",
            description: "The base URL of your Moodle installation",
          },
        },
      },
    ],
    security: [{ wstoken: [] }],
    tags: generateTags(schema.functions || []),
    paths,
    components: {
      ...components,
      securitySchemes: {
        wstoken: {
          type: "apiKey",
          in: "query",
          name: "wstoken",
          description:
            "Web service token. Generate in Moodle: Site administration > Plugins > Web services > Manage tokens",
        },
      },
    },
  };

  return openapi;
}

/**
 * Extract tag/category from function name (e.g., core_course_get_courses -> core_course)
 */
function getTagFromFunctionName(name) {
  const parts = name.split("_");
  if (parts.length >= 2) {
    return `${parts[0]}_${parts[1]}`;
  }
  return parts[0] || "misc";
}

/**
 * Generate unique tags from function names
 */
function generateTags(functions) {
  const tagSet = new Set();
  for (const func of functions) {
    tagSet.add(getTagFromFunctionName(func.name));
  }

  const tagDescriptions = {
    core_auth: "Authentication functions",
    core_blog: "Blog functions",
    core_calendar: "Calendar functions",
    core_cohort: "Cohort management",
    core_comment: "Comment functions",
    core_competency: "Competency framework",
    core_completion: "Course completion",
    core_course: "Course management",
    core_customfield: "Custom fields",
    core_enrol: "Enrollment functions",
    core_fetch: "Data fetching",
    core_files: "File management",
    core_filters: "Filter functions",
    core_form: "Form functions",
    core_grades: "Grade functions",
    core_group: "Group management",
    core_message: "Messaging functions",
    core_notes: "Notes functions",
    core_output: "Output functions",
    core_question: "Question bank",
    core_rating: "Rating functions",
    core_reportbuilder: "Report builder",
    core_role: "Role management",
    core_search: "Search functions",
    core_session: "Session management",
    core_table: "Table functions",
    core_tag: "Tag functions",
    core_user: "User management",
    core_webservice: "Web service functions",
    core_xapi: "xAPI functions",
    mod_assign: "Assignment module",
    mod_book: "Book module",
    mod_chat: "Chat module",
    mod_choice: "Choice module",
    mod_data: "Database module",
    mod_feedback: "Feedback module",
    mod_folder: "Folder module",
    mod_forum: "Forum module",
    mod_glossary: "Glossary module",
    mod_h5pactivity: "H5P activity module",
    mod_imscp: "IMS content package",
    mod_label: "Label module",
    mod_lesson: "Lesson module",
    mod_lti: "LTI module",
    mod_page: "Page module",
    mod_quiz: "Quiz module",
    mod_resource: "Resource module",
    mod_scorm: "SCORM module",
    mod_survey: "Survey module",
    mod_url: "URL module",
    mod_wiki: "Wiki module",
    mod_workshop: "Workshop module",
    tool_dataprivacy: "Data privacy tools",
    tool_lp: "Learning plans",
    tool_mobile: "Mobile app support",
    tool_policy: "Policy management",
    tool_usertours: "User tours",
    enrol_guest: "Guest enrollment",
    enrol_manual: "Manual enrollment",
    enrol_self: "Self enrollment",
    message_airnotifier: "Airnotifier messaging",
    message_popup: "Popup messaging",
    gradereport_grader: "Grader report",
    gradereport_overview: "Overview report",
    gradereport_user: "User grade report",
  };

  return Array.from(tagSet)
    .sort()
    .map((tag) => ({
      name: tag,
      description: tagDescriptions[tag] || `${tag} functions`,
    }));
}

/**
 * Process a single schema file
 */
function processSchema(schemaPath) {
  const schemaName = basename(schemaPath, ".json");
  console.log(`Processing schema: ${schemaName}`);

  const schemaContent = readFileSync(schemaPath, "utf-8");
  const schema = JSON.parse(schemaContent);

  const openapi = generateOpenAPISpec(schema, schemaName);

  // Write OpenAPI JSON
  const jsonPath = join(OPENAPI_DIR, `${schemaName}.json`);
  writeFileSync(jsonPath, JSON.stringify(openapi, null, 2));
  console.log(`  Generated ${jsonPath}`);

  // Write OpenAPI YAML (simple conversion)
  const yamlPath = join(OPENAPI_DIR, `${schemaName}.yaml`);
  writeFileSync(yamlPath, jsonToYaml(openapi));
  console.log(`  Generated ${yamlPath}`);

  return schemaName;
}

/**
 * Simple JSON to YAML converter (for basic structures)
 */
function jsonToYaml(obj, indent = 0) {
  const spaces = "  ".repeat(indent);
  let yaml = "";

  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      return "[]";
    }
    for (const item of obj) {
      if (typeof item === "object" && item !== null) {
        yaml += `\n${spaces}-`;
        const itemYaml = jsonToYaml(item, indent + 1);
        // Handle first property on same line as dash
        const lines = itemYaml.split("\n").filter((l) => l.trim());
        if (lines.length > 0) {
          yaml += ` ${lines[0].trim()}`;
          for (let i = 1; i < lines.length; i++) {
            yaml += `\n${spaces}  ${lines[i].trim()}`;
          }
        }
      } else {
        yaml += `\n${spaces}- ${formatYamlValue(item)}`;
      }
    }
    return yaml;
  }

  if (typeof obj === "object" && obj !== null) {
    const entries = Object.entries(obj);
    if (entries.length === 0) {
      return "{}";
    }
    for (const [key, value] of entries) {
      const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key) ? key : `"${key}"`;
      if (typeof value === "object" && value !== null) {
        const nestedYaml = jsonToYaml(value, indent + 1);
        if (nestedYaml.startsWith("\n") || nestedYaml === "{}" || nestedYaml === "[]") {
          yaml += `${spaces}${safeKey}:${nestedYaml === "{}" || nestedYaml === "[]" ? ` ${nestedYaml}` : nestedYaml}\n`;
        } else {
          yaml += `${spaces}${safeKey}: ${nestedYaml}\n`;
        }
      } else {
        yaml += `${spaces}${safeKey}: ${formatYamlValue(value)}\n`;
      }
    }
    return yaml;
  }

  return formatYamlValue(obj);
}

function formatYamlValue(value) {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    // Check if string needs quoting
    if (
      value === "" ||
      value.includes(":") ||
      value.includes("#") ||
      value.includes("\n") ||
      value.startsWith(" ") ||
      value.endsWith(" ") ||
      /^[0-9]/.test(value) ||
      ["true", "false", "null", "yes", "no"].includes(value.toLowerCase())
    ) {
      return `"${value.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return value;
  }
  return String(value);
}

/**
 * Main entry point
 */
function main() {
  const args = process.argv.slice(2);

  // Ensure output directory exists
  if (!existsSync(OPENAPI_DIR)) {
    mkdirSync(OPENAPI_DIR, { recursive: true });
  }

  let schemaFiles = [];

  if (args.length > 0) {
    schemaFiles = args.map((arg) => {
      if (arg.endsWith(".json")) {
        return arg;
      }
      return join(SCHEMAS_DIR, `${arg}.json`);
    });
  } else {
    if (!existsSync(SCHEMAS_DIR)) {
      console.log("No schemas directory found.");
      return;
    }

    schemaFiles = readdirSync(SCHEMAS_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => join(SCHEMAS_DIR, f));
  }

  if (schemaFiles.length === 0) {
    console.log("No schema files found.");
    return;
  }

  for (const schemaFile of schemaFiles) {
    if (!existsSync(schemaFile)) {
      console.error(`Schema file not found: ${schemaFile}`);
      continue;
    }
    processSchema(schemaFile);
  }

  console.log("\nOpenAPI generation complete!");
}

main();
