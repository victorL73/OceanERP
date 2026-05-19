<?php

require_once dirname(__FILE__, 3) . '/classes/ColissimoLabelFinder.php';

class OceanerpbridgeColissimolabelModuleFrontController extends ModuleFrontController
{
    public $ssl = true;

    public function initContent()
    {
        parent::initContent();

        $expectedToken = (string) Configuration::get('OCEANERP_BRIDGE_TOKEN');
        $providedToken = (string) Tools::getValue('token');
        if ($expectedToken === '' || !OceanerpBridgeColissimoLabelFinder::tokensMatch($expectedToken, $providedToken)) {
            OceanerpBridgeColissimoLabelFinder::sendText(403, 'Forbidden');
        }

        $orderId = (int) Tools::getValue('id_order');
        if ($orderId <= 0) {
            OceanerpBridgeColissimoLabelFinder::sendText(400, 'Missing id_order');
        }

        $file = OceanerpBridgeColissimoLabelFinder::find(
            $orderId,
            (string) Tools::getValue('order_reference'),
            (string) Tools::getValue('tracking')
        );

        if ($file === null) {
            OceanerpBridgeColissimoLabelFinder::sendText(404, 'Colissimo label not found');
        }

        OceanerpBridgeColissimoLabelFinder::sendFile($file);
    }
}
