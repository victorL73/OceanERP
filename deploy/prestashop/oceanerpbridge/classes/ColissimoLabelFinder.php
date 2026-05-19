<?php

class OceanerpBridgeColissimoLabelFinder
{
    private const MAX_SCANNED_FILES = 50000;

    public static function find($orderId, $orderReference, $tracking)
    {
        $needles = self::buildNeedles((int) $orderId, (string) $orderReference, (string) $tracking);
        $rows = [];

        foreach (self::rowsFromKnownRelations((int) $orderId, $needles) as $row) {
            $rows[] = $row;
            $needles = array_merge($needles, self::needlesFromRow($row));
        }

        foreach (self::rowsFromColissimoTables($needles) as $row) {
            $rows[] = $row;
            $needles = array_merge($needles, self::needlesFromRow($row));
        }

        $needles = array_values(array_unique(array_filter($needles)));

        foreach (self::prioritizeRows($rows) as $row) {
            $file = self::findInRow($row);
            if ($file !== null) {
                return $file;
            }
        }

        return self::findInKnownDirectories($needles);
    }

    public static function sendFile(array $file)
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        header('Content-Type: ' . $file['mime']);
        header('Content-Length: ' . strlen($file['content']));
        header('Content-Disposition: inline; filename="' . str_replace('"', '', $file['name']) . '"');
        echo $file['content'];
        exit;
    }

    public static function sendText($status, $message)
    {
        http_response_code((int) $status);
        header('Content-Type: text/plain; charset=utf-8');
        echo $message;
        exit;
    }

    public static function tokensMatch($expected, $provided)
    {
        if (function_exists('hash_equals')) {
            return hash_equals((string) $expected, (string) $provided);
        }

        return (string) $expected === (string) $provided;
    }

    private static function buildNeedles($orderId, $orderReference, $tracking)
    {
        $reference = self::cleanReference($orderReference);
        $needles = array_values(array_filter([(string) $orderId, $reference, self::cleanReference($tracking)]));
        $withoutPrefix = preg_replace('/^PS[-_]/i', '', $reference);
        if ($withoutPrefix !== $reference && $withoutPrefix !== '') {
            $needles[] = $withoutPrefix;
        }

        if (class_exists('Order')) {
            $order = new Order((int) $orderId);
            if (Validate::isLoadedObject($order)) {
                foreach (['reference', 'id_cart', 'id_customer', 'id_address_delivery', 'shipping_number', 'delivery_number', 'invoice_number'] as $property) {
                    if (!empty($order->{$property})) {
                        $needles[] = self::cleanReference((string) $order->{$property});
                    }
                }
            }
        }

        return array_values(array_unique(array_filter($needles)));
    }

    private static function rowsFromKnownRelations($orderId, array $needles)
    {
        $rows = [];
        $knownTables = [
            'colissimo_order',
            'colissimo_label',
            'colissimo_label_product',
            'colissimo_shipment',
            'colissimo_package',
            'colissimo_parcel',
            'colissimo_return',
            'colissimo_ace',
        ];

        $knownColumns = [
            'id_order',
            'order_id',
            'id_order_detail',
            'id_colissimo_order',
            'id_colissimo_label',
            'id_shipment',
            'id_label',
            'id_parcel',
            'order_reference',
            'reference',
            'shipping_number',
            'tracking_number',
            'parcel_number',
        ];

        foreach ($knownTables as $table) {
            foreach ($knownColumns as $column) {
                foreach (self::rowsByColumn($table, $column, $column === 'id_order' || $column === 'order_id' ? array_merge([(string) $orderId], $needles) : $needles) as $row) {
                    $rows[] = $row;
                }
            }
        }

        return $rows;
    }

    private static function rowsFromColissimoTables(array $needles)
    {
        $rows = [];
        foreach (self::listColissimoTables() as $table) {
            foreach (self::listSearchableColumns($table) as $column) {
                foreach (self::rowsByAnyValue($table, $column, $needles) as $row) {
                    $rows[] = $row;
                }
            }
        }

        return $rows;
    }

    private static function listColissimoTables()
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
            if (self::isSafeIdentifier($baseName)) {
                $tables[] = $baseName;
            }
        }

        return array_values(array_unique($tables));
    }

    private static function listSearchableColumns($table)
    {
        if (!self::isSafeIdentifier($table)) {
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
            if ($column === '' || !self::isSafeIdentifier($column)) {
                continue;
            }

            if (preg_match('/int|char|text|blob|binary|varbinary|decimal|float|double/i', $type)) {
                $columns[] = $column;
            }
        }

        return $columns;
    }

    private static function rowsByColumn($table, $column, array $values)
    {
        if (!self::tableExists($table) || !self::columnExists($table, $column)) {
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

        $sql = 'SELECT * FROM `' . _DB_PREFIX_ . pSQL($table) . '` WHERE `' . pSQL($column) . '` IN (' . implode(',', $escapedValues) . ') LIMIT 100';
        $rows = Db::getInstance()->executeS($sql);
        return is_array($rows) ? $rows : [];
    }

    private static function rowsByAnyValue($table, $column, array $values)
    {
        if (!self::tableExists($table) || !self::columnExists($table, $column)) {
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

        $sql = 'SELECT * FROM `' . _DB_PREFIX_ . pSQL($table) . '` WHERE ' . implode(' OR ', $conditions) . ' LIMIT 100';
        $rows = Db::getInstance()->executeS($sql);
        return is_array($rows) ? $rows : [];
    }

    private static function prioritizeRows(array $rows)
    {
        $uniqueRows = [];
        foreach ($rows as $row) {
            $key = md5(print_r($row, true));
            $uniqueRows[$key] = $row;
        }

        $rows = array_values($uniqueRows);
        usort($rows, static function ($left, $right) {
            return self::rowLabelScore($right) <=> self::rowLabelScore($left);
        });

        return $rows;
    }

    private static function rowLabelScore(array $row)
    {
        $score = 0;
        foreach ($row as $column => $value) {
            if (preg_match('/label|etiquette|pdf|file|path|url|content|base64|cn23|zpl|return/i', (string) $column)) {
                $score += 10;
            }

            if (is_string($value) && preg_match('/\.(pdf|zip|zpl|txt|cn23)|%PDF|base64/i', $value)) {
                $score += 5;
            }
        }

        return $score;
    }

    private static function needlesFromRow(array $row)
    {
        $needles = [];
        foreach ($row as $column => $value) {
            if (!is_scalar($value) || $value === '') {
                continue;
            }

            $string = self::cleanReference((string) $value);
            if ($string !== '' && strlen($string) <= 80) {
                $needles[] = $string;
            }
        }

        return array_values(array_unique($needles));
    }

    private static function findInRow(array $row)
    {
        $ordered = [];
        foreach ($row as $column => $value) {
            $key = preg_match('/label|etiquette|pdf|file|path|url|content|base64|cn23|zpl|return/i', (string) $column) ? '0_' : '1_';
            $ordered[$key . $column] = $value;
        }
        ksort($ordered);

        foreach ($ordered as $value) {
            if ($value === null || $value === '') {
                continue;
            }

            $file = self::findInValue($value);
            if ($file !== null) {
                return $file;
            }
        }

        return null;
    }

    private static function findInValue($value)
    {
        if (is_array($value)) {
            foreach ($value as $inner) {
                $file = self::findInValue($inner);
                if ($file !== null) {
                    return $file;
                }
            }

            return null;
        }

        if (!is_string($value)) {
            return null;
        }

        $decoded = self::decodeBase64Label($value);
        if ($decoded !== null) {
            return $decoded;
        }

        $path = self::resolveLocalPath($value);
        if ($path !== null) {
            return self::readLabelFile($path);
        }

        $json = json_decode($value, true);
        if (is_array($json)) {
            $file = self::findInValue($json);
            if ($file !== null) {
                return $file;
            }
        }

        $unserialized = @unserialize($value, ['allowed_classes' => false]);
        if (is_array($unserialized)) {
            $file = self::findInValue($unserialized);
            if ($file !== null) {
                return $file;
            }
        }

        foreach (self::extractPathCandidates($value) as $candidate) {
            $path = self::resolveLocalPath($candidate);
            if ($path !== null) {
                return self::readLabelFile($path);
            }
        }

        foreach (self::extractBase64Candidates($value) as $candidate) {
            $decoded = self::decodeBase64Label($candidate);
            if ($decoded !== null) {
                return $decoded;
            }
        }

        foreach (self::extractUrlCandidates($value) as $url) {
            $file = self::readRemoteLabel($url);
            if ($file !== null) {
                return $file;
            }
        }

        return null;
    }

    private static function extractPathCandidates($value)
    {
        $decoded = html_entity_decode((string) $value, ENT_QUOTES, 'UTF-8');
        preg_match_all('/(?:"|\')?([A-Za-z0-9_ .\/\\\\:-]+?\.(?:pdf|zip|zpl|txt|cn23))(?:"|\')?/i', $decoded, $matches);
        return isset($matches[1]) ? array_values(array_unique($matches[1])) : [];
    }

    private static function extractUrlCandidates($value)
    {
        $decoded = html_entity_decode((string) $value, ENT_QUOTES, 'UTF-8');
        preg_match_all('/https?:\/\/[^\s"\'<>]+/i', $decoded, $matches);
        return isset($matches[0]) ? array_values(array_unique($matches[0])) : [];
    }

    private static function extractBase64Candidates($value)
    {
        $decoded = html_entity_decode((string) $value, ENT_QUOTES, 'UTF-8');
        preg_match_all('/data:[^;]+;base64,[A-Za-z0-9+\/=\r\n]+/i', $decoded, $dataMatches);
        preg_match_all('/[A-Za-z0-9+\/]{120,}={0,2}/', $decoded, $rawMatches);

        return array_values(array_unique(array_merge($dataMatches[0] ?? [], $rawMatches[0] ?? [])));
    }

    private static function findInKnownDirectories(array $needles)
    {
        $directories = self::knownLabelDirectories();
        $extensions = ['pdf', 'zip', 'zpl', 'txt', 'cn23'];
        $checked = 0;

        foreach ($directories as $directory) {
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
                if (++$checked > self::MAX_SCANNED_FILES) {
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
                $pathName = $fileInfo->getPathname();
                foreach ($needles as $needle) {
                    if ($needle !== '' && (stripos($fileName, $needle) !== false || stripos($pathName, $needle) !== false)) {
                        return self::readLabelFile($pathName);
                    }
                }
            }
        }

        return null;
    }

    private static function knownLabelDirectories()
    {
        $directories = [
            _PS_ROOT_DIR_ . '/download',
            _PS_ROOT_DIR_ . '/upload',
            _PS_ROOT_DIR_ . '/var',
            _PS_ROOT_DIR_ . '/tmp',
        ];

        if (defined('_PS_DOWNLOAD_DIR_')) {
            $directories[] = _PS_DOWNLOAD_DIR_;
        }

        if (defined('_PS_UPLOAD_DIR_')) {
            $directories[] = _PS_UPLOAD_DIR_;
        }

        foreach (glob(_PS_ROOT_DIR_ . '/modules/*colissimo*', GLOB_ONLYDIR) ?: [] as $moduleDirectory) {
            $directories[] = $moduleDirectory;
        }

        foreach (glob(_PS_ROOT_DIR_ . '/modules/*laposte*', GLOB_ONLYDIR) ?: [] as $moduleDirectory) {
            $directories[] = $moduleDirectory;
        }

        return array_values(array_unique(array_filter($directories, static function ($directory) {
            return is_string($directory) && is_dir($directory);
        })));
    }

    private static function resolveLocalPath($value)
    {
        $candidate = html_entity_decode(trim((string) $value), ENT_QUOTES, 'UTF-8');
        if ($candidate === '') {
            return null;
        }

        if (preg_match('/^https?:\/\//i', $candidate)) {
            return null;
        }

        if (!preg_match('/\.(pdf|zip|zpl|txt|cn23)$/i', $candidate)) {
            return null;
        }

        $paths = [];
        if ($candidate[0] === '/' || preg_match('/^[A-Za-z]:\\\\/', $candidate)) {
            $paths[] = $candidate;
        } else {
            $paths[] = _PS_ROOT_DIR_ . '/' . ltrim($candidate, '/');
            foreach (self::knownLabelDirectories() as $directory) {
                $paths[] = rtrim($directory, '/\\') . '/' . ltrim($candidate, '/');
            }
        }

        foreach ($paths as $path) {
            $realPath = realpath($path);
            if ($realPath !== false && is_file($realPath) && self::isSafePath($realPath)) {
                return $realPath;
            }
        }

        return null;
    }

    private static function readLabelFile($path)
    {
        $realPath = realpath($path);
        if ($realPath === false || !is_file($realPath) || !self::isSafePath($realPath)) {
            return null;
        }

        $content = file_get_contents($realPath);
        if ($content === false || !self::looksLikeLabelContent($content, $realPath)) {
            return null;
        }

        return [
            'name' => basename($realPath),
            'mime' => self::mimeFromContent($content, $realPath),
            'content' => $content,
        ];
    }

    private static function readRemoteLabel($url)
    {
        if (!self::isSameShopUrl($url)) {
            return null;
        }

        $context = stream_context_create([
            'http' => ['timeout' => 10],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
        $content = @file_get_contents($url, false, $context);
        if ($content === false || !self::looksLikeLabelContent($content, $url)) {
            return null;
        }

        return [
            'name' => 'etiquette-colissimo.' . self::extensionFromContent($content, $url),
            'mime' => self::mimeFromContent($content, $url),
            'content' => $content,
        ];
    }

    private static function decodeBase64Label($value)
    {
        $normalized = trim((string) $value);
        if (preg_match('/^data:(?<mime>[^;]+);base64,(?<data>.+)$/is', $normalized, $matches)) {
            $normalized = $matches['data'];
        }

        $normalized = preg_replace('/\s+/', '', $normalized);
        if (strlen($normalized) < 80) {
            return null;
        }

        $content = base64_decode($normalized, true);
        if ($content === false || !self::looksLikeLabelContent($content, 'label.pdf')) {
            return null;
        }

        return [
            'name' => 'etiquette-colissimo.' . self::extensionFromContent($content, 'label.pdf'),
            'mime' => self::mimeFromContent($content, 'label.pdf'),
            'content' => $content,
        ];
    }

    private static function tableExists($table)
    {
        if (!self::isSafeIdentifier($table)) {
            return false;
        }

        $rows = Db::getInstance()->executeS("SHOW TABLES LIKE '" . pSQL(_DB_PREFIX_ . $table) . "'");
        return is_array($rows) && count($rows) > 0;
    }

    private static function columnExists($table, $column)
    {
        if (!self::isSafeIdentifier($table) || !self::isSafeIdentifier($column)) {
            return false;
        }

        $rows = Db::getInstance()->executeS('SHOW COLUMNS FROM `' . _DB_PREFIX_ . pSQL($table) . "` LIKE '" . pSQL($column) . "'");
        return is_array($rows) && count($rows) > 0;
    }

    private static function isSafeIdentifier($value)
    {
        return preg_match('/^[A-Za-z0-9_]+$/', (string) $value) === 1;
    }

    private static function isSafePath($path)
    {
        $root = realpath(_PS_ROOT_DIR_);
        return $root !== false && strpos($path, $root) === 0;
    }

    private static function isSameShopUrl($url)
    {
        $shopUrl = Tools::getShopDomainSsl(true, true);
        $candidateHost = parse_url($url, PHP_URL_HOST);
        $shopHost = parse_url($shopUrl, PHP_URL_HOST);

        return $candidateHost !== false
            && $shopHost !== false
            && strtolower((string) $candidateHost) === strtolower((string) $shopHost);
    }

    private static function looksLikeLabelContent($content, $path)
    {
        return strpos($content, '%PDF') === 0
            || strpos($content, "PK\x03\x04") === 0
            || preg_match('/\^XA/i', substr($content, 0, 200)) === 1
            || preg_match('/\.(pdf|zip|zpl|txt|cn23)$/i', (string) $path);
    }

    private static function mimeFromContent($content, $path)
    {
        if (strpos($content, '%PDF') === 0 || preg_match('/\.pdf$/i', (string) $path)) {
            return 'application/pdf';
        }

        if (strpos($content, "PK\x03\x04") === 0 || preg_match('/\.zip$/i', (string) $path)) {
            return 'application/zip';
        }

        return 'text/plain';
    }

    private static function extensionFromContent($content, $path)
    {
        if (strpos($content, '%PDF') === 0 || preg_match('/\.pdf$/i', (string) $path)) {
            return 'pdf';
        }

        if (strpos($content, "PK\x03\x04") === 0 || preg_match('/\.zip$/i', (string) $path)) {
            return 'zip';
        }

        return 'txt';
    }

    private static function cleanReference($value)
    {
        return preg_replace('/[^A-Za-z0-9_-]/', '', (string) $value);
    }
}
