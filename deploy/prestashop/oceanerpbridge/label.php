<?php

$prestashopRoot = dirname(__FILE__, 3);
require_once $prestashopRoot . '/config/config.inc.php';
require_once $prestashopRoot . '/init.php';

$expectedToken = (string) Configuration::get('OCEANERP_BRIDGE_TOKEN');
$providedToken = (string) Tools::getValue('token');
if ($expectedToken === '' || !tokens_match($expectedToken, $providedToken)) {
    send_text(403, 'Forbidden');
}

$orderId = (int) Tools::getValue('id_order');
if ($orderId <= 0) {
    send_text(400, 'Missing id_order');
}

$orderReference = clean_reference((string) Tools::getValue('order_reference'));
$tracking = clean_reference((string) Tools::getValue('tracking'));
$file = find_colissimo_label($orderId, $orderReference, $tracking);

if ($file === null) {
    send_text(404, 'Colissimo label not found');
}

send_file($file['content'], $file['mime'], $file['name']);

function clean_reference($value)
{
    return preg_replace('/[^A-Za-z0-9_-]/', '', $value);
}

function find_colissimo_label($orderId, $orderReference, $tracking)
{
    $needles = build_needles($orderId, $orderReference, $tracking);
    $rows = [];

    foreach (rows_by_column('colissimo_order', 'id_order', [$orderId]) as $row) {
        $rows[] = $row;
        foreach (['id_colissimo_order', 'id', 'id_shipment', 'id_label'] as $column) {
            if (!empty($row[$column])) {
                $needles[] = (string) $row[$column];
                foreach (rows_by_column('colissimo_label', 'id_colissimo_order', [$row[$column]]) as $labelRow) {
                    $rows[] = $labelRow;
                    if (!empty($labelRow['id_colissimo_label'])) {
                        $needles[] = (string) $labelRow['id_colissimo_label'];
                    }
                }
            }
        }
    }

    foreach (['colissimo_label', 'colissimo_label_product', 'colissimo_shipment', 'colissimo_package', 'colissimo_order'] as $table) {
        foreach (['id_order', 'order_id', 'id_order_detail', 'id_colissimo_order', 'order_reference', 'reference', 'tracking_number', 'shipping_number'] as $column) {
            foreach (rows_by_column($table, $column, $needles) as $row) {
                $rows[] = $row;
            }
        }
    }

    foreach (rows_from_colissimo_tables($needles) as $row) {
        $rows[] = $row;
    }

    foreach ($rows as $row) {
        $file = find_in_row($row);
        if ($file !== null) {
            return $file;
        }
    }

    return find_in_known_directories(array_unique(array_filter($needles)));
}

function build_needles($orderId, $orderReference, $tracking)
{
    $needles = array_values(array_filter([(string) $orderId, $orderReference, $tracking]));
    $withoutPrefix = preg_replace('/^PS[-_]/i', '', $orderReference);
    if ($withoutPrefix !== $orderReference && $withoutPrefix !== '') {
        $needles[] = $withoutPrefix;
    }

    if (class_exists('Order')) {
        $order = new Order((int) $orderId);
        if (Validate::isLoadedObject($order)) {
            foreach (['reference', 'id_cart', 'id_customer', 'id_address_delivery', 'shipping_number'] as $property) {
                if (!empty($order->{$property})) {
                    $needles[] = clean_reference((string) $order->{$property});
                }
            }
        }
    }

    return array_values(array_unique(array_filter($needles)));
}

function rows_by_column($table, $column, array $values)
{
    if (!table_exists($table) || !column_exists($table, $column)) {
        return [];
    }

    $escapedValues = array_map(static function ($value) {
        return "'" . pSQL((string) $value) . "'";
    }, array_filter($values, static function ($value) {
        return (string) $value !== '';
    }));

    if (count($escapedValues) === 0) {
        return [];
    }

    $sql = 'SELECT * FROM `' . _DB_PREFIX_ . pSQL($table) . '` WHERE `' . pSQL($column) . '` IN (' . implode(',', $escapedValues) . ')';
    $rows = Db::getInstance()->executeS($sql);
    return is_array($rows) ? $rows : [];
}

function rows_from_colissimo_tables(array $needles)
{
    $rows = [];
    foreach (list_colissimo_tables() as $table) {
        foreach (list_searchable_columns($table) as $column) {
            foreach (rows_by_any_value($table, $column, $needles) as $row) {
                $rows[] = $row;
            }
        }
    }

    return $rows;
}

function list_colissimo_tables()
{
    $rows = Db::getInstance()->executeS("SHOW TABLES LIKE '" . pSQL(_DB_PREFIX_) . "%colissimo%'");
    if (!is_array($rows)) {
        return [];
    }

    $tables = [];
    foreach ($rows as $row) {
        $tableName = reset($row);
        if (!is_string($tableName) || strpos($tableName, _DB_PREFIX_) !== 0) {
            continue;
        }

        $baseName = substr($tableName, strlen(_DB_PREFIX_));
        if (is_safe_identifier($baseName)) {
            $tables[] = $baseName;
        }
    }

    return array_values(array_unique($tables));
}

function list_searchable_columns($table)
{
    if (!is_safe_identifier($table)) {
        return [];
    }

    $rows = Db::getInstance()->executeS('SHOW COLUMNS FROM `' . _DB_PREFIX_ . pSQL($table) . '`');
    if (!is_array($rows)) {
        return [];
    }

    $columns = [];
    foreach ($rows as $row) {
        $column = isset($row['Field']) ? (string) $row['Field'] : '';
        $type = isset($row['Type']) ? strtolower((string) $row['Type']) : '';
        if ($column === '' || !is_safe_identifier($column)) {
            continue;
        }

        if (preg_match('/int|char|text|blob|binary|varbinary|decimal|float|double/i', $type)) {
            $columns[] = $column;
        }
    }

    return $columns;
}

function rows_by_any_value($table, $column, array $values)
{
    if (!table_exists($table) || !column_exists($table, $column)) {
        return [];
    }

    $conditions = [];
    foreach (array_filter($values, static function ($value) {
        return (string) $value !== '';
    }) as $value) {
        $escaped = pSQL((string) $value);
        $conditions[] = '`' . pSQL($column) . "` = '" . $escaped . "'";
        if (strlen((string) $value) >= 3) {
            $conditions[] = '`' . pSQL($column) . "` LIKE '%" . $escaped . "%'";
        }
    }

    if (count($conditions) === 0) {
        return [];
    }

    $sql = 'SELECT * FROM `' . _DB_PREFIX_ . pSQL($table) . '` WHERE ' . implode(' OR ', $conditions) . ' LIMIT 50';
    $rows = Db::getInstance()->executeS($sql);
    return is_array($rows) ? $rows : [];
}

function is_safe_identifier($value)
{
    return preg_match('/^[A-Za-z0-9_]+$/', $value) === 1;
}

function find_in_row(array $row)
{
    foreach ($row as $column => $value) {
        if ($value === null || $value === '') {
            continue;
        }

        if (is_string($value)) {
            $decoded = decode_base64_label($value);
            if ($decoded !== null) {
                return $decoded;
            }

            $path = resolve_local_path($value);
            if ($path !== null) {
                return read_label_file($path);
            }
        }
    }

    return null;
}

function find_in_known_directories(array $needles)
{
    $directories = [
        _PS_ROOT_DIR_ . '/modules/colissimo',
        _PS_ROOT_DIR_ . '/modules/colissimo/documents',
        _PS_ROOT_DIR_ . '/modules/colissimo/labels',
        _PS_ROOT_DIR_ . '/modules/colissimo/files',
        _PS_ROOT_DIR_ . '/modules/colissimo/download',
        _PS_ROOT_DIR_ . '/modules/colissimo/views',
        _PS_ROOT_DIR_ . '/download',
        _PS_ROOT_DIR_ . '/upload',
    ];

    if (defined('_PS_DOWNLOAD_DIR_')) {
        $directories[] = _PS_DOWNLOAD_DIR_;
    }

    $extensions = ['pdf', 'zip', 'zpl'];
    $checked = 0;

    foreach (array_unique($directories) as $directory) {
        if (!is_dir($directory)) {
            continue;
        }

        try {
            $iterator = new RecursiveIteratorIterator(
                new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
                RecursiveIteratorIterator::SELF_FIRST
            );
        } catch (Exception $exception) {
            continue;
        }

        foreach ($iterator as $fileInfo) {
            if (++$checked > 25000) {
                return null;
            }

            if (!$fileInfo->isFile()) {
                continue;
            }

            $extension = strtolower($fileInfo->getExtension());
            if (!in_array($extension, $extensions, true)) {
                continue;
            }

            $fileName = $fileInfo->getFilename();
            foreach ($needles as $needle) {
                if ($needle !== '' && stripos($fileName, $needle) !== false) {
                    return read_label_file($fileInfo->getPathname());
                }
            }
        }
    }

    return null;
}

function resolve_local_path($value)
{
    $candidate = html_entity_decode(trim($value), ENT_QUOTES, 'UTF-8');
    if ($candidate === '' || preg_match('/^https?:\/\//i', $candidate)) {
        return null;
    }

    if (!preg_match('/\.(pdf|zip|zpl)$/i', $candidate)) {
        return null;
    }

    $paths = [];
    if ($candidate[0] === '/' || preg_match('/^[A-Za-z]:\\\\/', $candidate)) {
        $paths[] = $candidate;
    } else {
        $paths[] = _PS_ROOT_DIR_ . '/' . ltrim($candidate, '/');
        $paths[] = _PS_ROOT_DIR_ . '/modules/colissimo/' . ltrim($candidate, '/');
    }

    foreach ($paths as $path) {
        $realPath = realpath($path);
        if ($realPath !== false && is_file($realPath) && is_safe_path($realPath)) {
            return $realPath;
        }
    }

    return null;
}

function read_label_file($path)
{
    $realPath = realpath($path);
    if ($realPath === false || !is_file($realPath) || !is_safe_path($realPath)) {
        return null;
    }

    $content = file_get_contents($realPath);
    if ($content === false || !looks_like_label_content($content, $realPath)) {
        return null;
    }

    return [
        'name' => basename($realPath),
        'mime' => mime_from_content($content, $realPath),
        'content' => $content,
    ];
}

function decode_base64_label($value)
{
    $normalized = trim($value);
    if (preg_match('/^data:(?<mime>[^;]+);base64,(?<data>.+)$/is', $normalized, $matches)) {
        $normalized = $matches['data'];
    }

    $normalized = preg_replace('/\s+/', '', $normalized);
    if (strlen($normalized) < 80) {
        return null;
    }

    $content = base64_decode($normalized, true);
    if ($content === false || !looks_like_label_content($content, 'label.pdf')) {
        return null;
    }

    return [
        'name' => 'etiquette-colissimo.pdf',
        'mime' => mime_from_content($content, 'label.pdf'),
        'content' => $content,
    ];
}

function table_exists($table)
{
    $rows = Db::getInstance()->executeS("SHOW TABLES LIKE '" . pSQL(_DB_PREFIX_ . $table) . "'");
    return is_array($rows) && count($rows) > 0;
}

function column_exists($table, $column)
{
    $rows = Db::getInstance()->executeS('SHOW COLUMNS FROM `' . _DB_PREFIX_ . pSQL($table) . "` LIKE '" . pSQL($column) . "'");
    return is_array($rows) && count($rows) > 0;
}

function is_safe_path($path)
{
    $root = realpath(_PS_ROOT_DIR_);
    return $root !== false && strpos($path, $root) === 0;
}

function looks_like_label_content($content, $path)
{
    return strpos($content, '%PDF') === 0
        || strpos($content, "PK\x03\x04") === 0
        || preg_match('/\.(pdf|zip|zpl)$/i', $path);
}

function mime_from_content($content, $path)
{
    if (strpos($content, '%PDF') === 0 || preg_match('/\.pdf$/i', $path)) {
        return 'application/pdf';
    }

    if (strpos($content, "PK\x03\x04") === 0 || preg_match('/\.zip$/i', $path)) {
        return 'application/zip';
    }

    return 'text/plain';
}

function send_file($content, $mime, $fileName)
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    header('Content-Type: ' . $mime);
    header('Content-Length: ' . strlen($content));
    header('Content-Disposition: inline; filename="' . str_replace('"', '', $fileName) . '"');
    echo $content;
    exit;
}

function send_text($status, $message)
{
    http_response_code($status);
    header('Content-Type: text/plain; charset=utf-8');
    echo $message;
    exit;
}

function tokens_match($expected, $provided)
{
    if (function_exists('hash_equals')) {
        return hash_equals($expected, $provided);
    }

    return $expected === $provided;
}
