<?php

$prestashopRoot = dirname(__FILE__, 3);
require_once $prestashopRoot . '/config/config.inc.php';
require_once $prestashopRoot . '/init.php';
require_once __DIR__ . '/classes/ColissimoLabelFinder.php';

$expectedToken = (string) Configuration::get('OCEANERP_BRIDGE_TOKEN');
$providedToken = (string) Tools::getValue('token');
if ($expectedToken === '' || !OceanerpBridgeColissimoLabelFinder::tokensMatch($expectedToken, $providedToken)) {
    OceanerpBridgeColissimoLabelFinder::sendText(403, 'Forbidden');
}

$orderId = (int) Tools::getValue('id_order');
if ($orderId <= 0) {
    OceanerpBridgeColissimoLabelFinder::sendText(400, 'Missing id_order');
}

$orderReference = (string) Tools::getValue('order_reference');
$tracking = (string) Tools::getValue('tracking');
$file = OceanerpBridgeColissimoLabelFinder::find($orderId, $orderReference, $tracking);

if ($file === null) {
    OceanerpBridgeColissimoLabelFinder::sendText(404, 'Colissimo label not found');
}

OceanerpBridgeColissimoLabelFinder::sendFile($file);
