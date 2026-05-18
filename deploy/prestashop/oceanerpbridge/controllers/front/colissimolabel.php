<?php

class OceanerpbridgeColissimolabelModuleFrontController extends ModuleFrontController
{
    public $ssl = true;

    public function initContent()
    {
        parent::initContent();

        $expectedToken = (string) Configuration::get('OCEANERP_BRIDGE_TOKEN');
        $providedToken = (string) Tools::getValue('token');
        if ($expectedToken === '' || !$this->tokensMatch($expectedToken, $providedToken)) {
            $this->sendText(403, 'Forbidden');
        }

        $orderId = (int) Tools::getValue('id_order');
        if ($orderId <= 0) {
            $this->sendText(400, 'Missing id_order');
        }

        $orderReference = preg_replace('/[^A-Za-z0-9_-]/', '', (string) Tools::getValue('order_reference'));
        $tracking = preg_replace('/[^A-Za-z0-9_-]/', '', (string) Tools::getValue('tracking'));
        $file = $this->findColissimoLabel($orderId, $orderReference, $tracking);

        if ($file === null) {
            $this->sendText(404, 'Colissimo label not found');
        }

        $this->sendFile($file['content'], $file['mime'], $file['name']);
    }

    private function findColissimoLabel($orderId, $orderReference, $tracking)
    {
        $needles = array_values(array_filter([(string) $orderId, $orderReference, $tracking]));
        $rows = [];

        foreach ($this->rowsByColumn('colissimo_order', 'id_order', [$orderId]) as $row) {
            $rows[] = $row;
            foreach (['id_colissimo_order', 'id'] as $column) {
                if (!empty($row[$column])) {
                    $needles[] = (string) $row[$column];
                    foreach ($this->rowsByColumn('colissimo_label', 'id_colissimo_order', [$row[$column]]) as $labelRow) {
                        $rows[] = $labelRow;
                        if (!empty($labelRow['id_colissimo_label'])) {
                            $needles[] = (string) $labelRow['id_colissimo_label'];
                        }
                    }
                }
            }
        }

        foreach (['colissimo_label', 'colissimo_label_product'] as $table) {
            foreach (['id_order', 'order_id', 'id_order_detail'] as $column) {
                foreach ($this->rowsByColumn($table, $column, [$orderId]) as $row) {
                    $rows[] = $row;
                }
            }
        }

        foreach ($rows as $row) {
            $file = $this->findInRow($row);
            if ($file !== null) {
                return $file;
            }
        }

        return $this->findInKnownDirectories(array_unique(array_filter($needles)));
    }

    private function rowsByColumn($table, $column, array $values)
    {
        if (!$this->tableExists($table) || !$this->columnExists($table, $column)) {
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

    private function findInRow(array $row)
    {
        foreach ($row as $column => $value) {
            if ($value === null || $value === '') {
                continue;
            }

            if (is_string($value)) {
                $decoded = $this->decodeBase64Label($value);
                if ($decoded !== null) {
                    return $decoded;
                }

                $path = $this->resolveLocalPath($value);
                if ($path !== null) {
                    return $this->readLabelFile($path);
                }
            }
        }

        return null;
    }

    private function findInKnownDirectories(array $needles)
    {
        $directories = [
            _PS_ROOT_DIR_ . '/modules/colissimo',
            _PS_ROOT_DIR_ . '/modules/colissimo/documents',
            _PS_ROOT_DIR_ . '/modules/colissimo/labels',
            _PS_ROOT_DIR_ . '/modules/colissimo/files',
            _PS_ROOT_DIR_ . '/modules/colissimo/download',
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
                if (++$checked > 15000) {
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
                        return $this->readLabelFile($fileInfo->getPathname());
                    }
                }
            }
        }

        return null;
    }

    private function resolveLocalPath($value)
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
            if ($realPath !== false && is_file($realPath) && $this->isSafePath($realPath)) {
                return $realPath;
            }
        }

        return null;
    }

    private function readLabelFile($path)
    {
        $realPath = realpath($path);
        if ($realPath === false || !is_file($realPath) || !$this->isSafePath($realPath)) {
            return null;
        }

        $content = file_get_contents($realPath);
        if ($content === false || !$this->looksLikeLabelContent($content, $realPath)) {
            return null;
        }

        return [
            'name' => basename($realPath),
            'mime' => $this->mimeFromContent($content, $realPath),
            'content' => $content,
        ];
    }

    private function decodeBase64Label($value)
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
        if ($content === false || !$this->looksLikeLabelContent($content, 'label.pdf')) {
            return null;
        }

        return [
            'name' => 'etiquette-colissimo.pdf',
            'mime' => $this->mimeFromContent($content, 'label.pdf'),
            'content' => $content,
        ];
    }

    private function tableExists($table)
    {
        $rows = Db::getInstance()->executeS("SHOW TABLES LIKE '" . pSQL(_DB_PREFIX_ . $table) . "'");
        return is_array($rows) && count($rows) > 0;
    }

    private function columnExists($table, $column)
    {
        $rows = Db::getInstance()->executeS('SHOW COLUMNS FROM `' . _DB_PREFIX_ . pSQL($table) . "` LIKE '" . pSQL($column) . "'");
        return is_array($rows) && count($rows) > 0;
    }

    private function isSafePath($path)
    {
        $root = realpath(_PS_ROOT_DIR_);
        return $root !== false && strpos($path, $root) === 0;
    }

    private function looksLikeLabelContent($content, $path)
    {
        return strpos($content, '%PDF') === 0
            || strpos($content, "PK\x03\x04") === 0
            || preg_match('/\.(pdf|zip|zpl)$/i', $path);
    }

    private function mimeFromContent($content, $path)
    {
        if (strpos($content, '%PDF') === 0 || preg_match('/\.pdf$/i', $path)) {
            return 'application/pdf';
        }

        if (strpos($content, "PK\x03\x04") === 0 || preg_match('/\.zip$/i', $path)) {
            return 'application/zip';
        }

        return 'text/plain';
    }

    private function sendFile($content, $mime, $fileName)
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

    private function sendText($status, $message)
    {
        http_response_code($status);
        header('Content-Type: text/plain; charset=utf-8');
        echo $message;
        exit;
    }

    private function tokensMatch($expected, $provided)
    {
        if (function_exists('hash_equals')) {
            return hash_equals($expected, $provided);
        }

        return $expected === $provided;
    }
}
