<?php
/**
 * Extract Moodle Web Service function metadata to JSON
 * 
 * This script must be run within a Moodle installation context.
 * It extracts all available web service functions and their parameters/return types.
 * 
 * Usage:
 *   php extract-ws.php > ../schemas/MOODLE_XXX_STABLE.json
 * 
 * Requirements:
 *   - Must be placed in Moodle's root directory or have access to config.php
 *   - The web services must be enabled in Moodle
 */

define('CLI_SCRIPT', true);
define('NO_OUTPUT_BUFFERING', true);

// Find and load Moodle's config
$moodleRoot = getenv('MOODLE_ROOT') ?: dirname(__FILE__);
$configPath = $moodleRoot . '/config.php';

if (!file_exists($configPath)) {
    fwrite(STDERR, "Error: Could not find config.php at $configPath\n");
    fwrite(STDERR, "Set MOODLE_ROOT environment variable or place this script in Moodle's root directory.\n");
    exit(1);
}

require_once($configPath);
require_once($CFG->libdir . '/externallib.php');
require_once($CFG->libdir . '/adminlib.php');

// Get all external functions
$functions = $DB->get_records('external_functions', null, 'name ASC');

if (empty($functions)) {
    fwrite(STDERR, "Warning: No external functions found. Are web services enabled?\n");
}

$output = [
    'moodleVersion' => $CFG->version,
    'moodleRelease' => $CFG->release,
    'generatedAt' => date('c'),
    'functions' => [],
];

foreach ($functions as $function) {
    try {
        $functionInfo = external_api::external_function_info($function);
        
        if (!$functionInfo) {
            continue;
        }
        
        $funcData = [
            'name' => $function->name,
            'classname' => $function->classname ?? null,
            'methodname' => $function->methodname ?? null,
            'description' => $functionInfo->description ?? '',
            'type' => $functionInfo->type ?? 'read',
            'ajax' => !empty($functionInfo->allowed_from_ajax),
            'loginrequired' => $functionInfo->loginrequired ?? true,
            'readonlysession' => $functionInfo->readonlysession ?? true,
            'capabilities' => $functionInfo->capabilities ?? '',
            'services' => [],
        ];
        
        // Get services that include this function
        $services = $DB->get_records_sql("
            SELECT s.shortname, s.name 
            FROM {external_services} s
            JOIN {external_services_functions} sf ON sf.externalserviceid = s.id
            WHERE sf.functionname = ?
        ", [$function->name]);
        
        foreach ($services as $service) {
            $funcData['services'][] = [
                'shortname' => $service->shortname,
                'name' => $service->name,
            ];
        }
        
        // Extract parameter structure
        if (isset($functionInfo->parameters_desc) && $functionInfo->parameters_desc instanceof external_function_parameters) {
            $funcData['parameters'] = extractStructure($functionInfo->parameters_desc);
        } else {
            $funcData['parameters'] = ['type' => 'object', 'properties' => []];
        }
        
        // Extract return structure
        if (isset($functionInfo->returns_desc)) {
            $funcData['returns'] = extractStructure($functionInfo->returns_desc);
        } else {
            $funcData['returns'] = null;
        }
        
        $output['functions'][] = $funcData;
        
    } catch (Exception $e) {
        fwrite(STDERR, "Warning: Could not process function {$function->name}: " . $e->getMessage() . "\n");
    }
}

// Output JSON
echo json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

/**
 * Recursively extract the structure of an external_description
 */
function extractStructure($desc) {
    if ($desc === null) {
        return null;
    }
    
    if ($desc instanceof external_value) {
        return extractValue($desc);
    }
    
    if ($desc instanceof external_single_structure) {
        return extractSingleStructure($desc);
    }
    
    if ($desc instanceof external_multiple_structure) {
        return extractMultipleStructure($desc);
    }
    
    if ($desc instanceof external_function_parameters) {
        // Treat as single structure
        $keys = $desc->keys ?? [];
        $properties = [];
        $required = [];
        
        foreach ($keys as $key => $value) {
            $properties[$key] = extractStructure($value);
            if ($value instanceof external_value && $value->required == VALUE_REQUIRED) {
                $required[] = $key;
            } elseif (!($value instanceof external_value)) {
                // Complex types - check if they have required flag
                if (isset($value->required) && $value->required == VALUE_REQUIRED) {
                    $required[] = $key;
                }
            }
        }
        
        return [
            'type' => 'object',
            'properties' => $properties,
            'required' => $required,
        ];
    }
    
    // Fallback for unknown types
    return [
        'type' => 'unknown',
        'class' => get_class($desc),
    ];
}

/**
 * Extract external_value structure
 */
function extractValue($value) {
    $typeMap = [
        PARAM_INT => 'integer',
        PARAM_FLOAT => 'number',
        PARAM_BOOL => 'boolean',
        PARAM_TEXT => 'string',
        PARAM_RAW => 'string',
        PARAM_CLEANHTML => 'string',
        PARAM_NOTAGS => 'string',
        PARAM_FILE => 'string',
        PARAM_PATH => 'string',
        PARAM_URL => 'string',
        PARAM_LOCALURL => 'string',
        PARAM_EMAIL => 'string',
        PARAM_ALPHANUMEXT => 'string',
        PARAM_ALPHA => 'string',
        PARAM_ALPHAEXT => 'string',
        PARAM_ALPHANUM => 'string',
        PARAM_SEQUENCE => 'string',
        PARAM_COMPONENT => 'string',
        PARAM_AREA => 'string',
        PARAM_PLUGIN => 'string',
        PARAM_SAFEDIR => 'string',
        PARAM_SAFEPATH => 'string',
        PARAM_LANG => 'string',
        PARAM_THEME => 'string',
        PARAM_TIMEZONE => 'string',
        PARAM_CAPABILITY => 'string',
        PARAM_PERMISSION => 'integer',
        PARAM_USERNAME => 'string',
        PARAM_HOST => 'string',
        PARAM_STRINGID => 'string',
    ];
    
    $type = $typeMap[$value->type] ?? 'string';
    
    $result = [
        'type' => $type,
        'description' => $value->desc ?? '',
    ];
    
    // Add requirement info
    if ($value->required == VALUE_REQUIRED) {
        $result['required'] = true;
    } elseif ($value->required == VALUE_OPTIONAL) {
        $result['required'] = false;
    } elseif ($value->required == VALUE_DEFAULT) {
        $result['required'] = false;
        $result['default'] = $value->default;
    }
    
    // Add allowed values if present (for enums)
    if (!empty($value->allownull)) {
        $result['nullable'] = true;
    }
    
    return $result;
}

/**
 * Extract external_single_structure
 */
function extractSingleStructure($struct) {
    $keys = $struct->keys ?? [];
    $properties = [];
    $required = [];
    
    foreach ($keys as $key => $value) {
        $properties[$key] = extractStructure($value);
        
        // Determine if required
        if ($value instanceof external_value) {
            if ($value->required == VALUE_REQUIRED) {
                $required[] = $key;
            }
        } else {
            // For complex types, check the required property
            if (isset($value->required) && $value->required == VALUE_REQUIRED) {
                $required[] = $key;
            }
        }
    }
    
    $result = [
        'type' => 'object',
        'description' => $struct->desc ?? '',
        'properties' => $properties,
    ];
    
    if (!empty($required)) {
        $result['required'] = $required;
    }
    
    return $result;
}

/**
 * Extract external_multiple_structure
 */
function extractMultipleStructure($struct) {
    $content = $struct->content ?? null;
    
    $result = [
        'type' => 'array',
        'description' => $struct->desc ?? '',
    ];
    
    if ($content !== null) {
        $result['items'] = extractStructure($content);
    }
    
    return $result;
}
