<?php

if (!defined('_PS_VERSION_')) {
    exit;
}

class Oceanerpbridge extends Module
{
    public function __construct()
    {
        $this->name = 'oceanerpbridge';
        $this->tab = 'administration';
        $this->version = '0.2.0';
        $this->author = 'OceanERP';
        $this->need_instance = 0;
        $this->bootstrap = true;

        parent::__construct();

        $this->displayName = 'OceanERP Bridge';
        $this->description = 'Expose de facon securisee certains documents generes par PrestaShop vers OceanERP.';
        $this->ps_versions_compliancy = ['min' => '1.7.0.0', 'max' => _PS_VERSION_];
    }

    public function install()
    {
        return parent::install()
            && Configuration::updateValue('OCEANERP_BRIDGE_TOKEN', $this->defaultToken());
    }

    public function uninstall()
    {
        return Configuration::deleteByName('OCEANERP_BRIDGE_TOKEN') && parent::uninstall();
    }

    public function getContent()
    {
        $output = '';
        if (Tools::isSubmit('submitOceanerpBridge')) {
            $token = trim((string) Tools::getValue('OCEANERP_BRIDGE_TOKEN'));
            if ($token === '') {
                $output .= $this->displayError('Le token est obligatoire.');
            } else {
                Configuration::updateValue('OCEANERP_BRIDGE_TOKEN', $token);
                $output .= $this->displayConfirmation('Configuration enregistree.');
            }
        }

        $token = htmlspecialchars((string) Configuration::get('OCEANERP_BRIDGE_TOKEN'), ENT_QUOTES, 'UTF-8');
        $shopUrl = Tools::getShopDomainSsl(true, true);
        $directEndpoint = htmlspecialchars($shopUrl . __PS_BASE_URI__ . 'modules/oceanerpbridge/label.php?token=' . (string) Configuration::get('OCEANERP_BRIDGE_TOKEN') . '&id_order={orderId}&order_reference={orderNumber}&tracking={trackingNumber}', ENT_QUOTES, 'UTF-8');
        $frontEndpoint = htmlspecialchars($shopUrl . __PS_BASE_URI__ . 'module/oceanerpbridge/colissimolabel?token=' . (string) Configuration::get('OCEANERP_BRIDGE_TOKEN') . '&id_order={orderId}&order_reference={orderNumber}&tracking={trackingNumber}', ENT_QUOTES, 'UTF-8');
        return $output . '
            <form method="post">
                <div class="panel">
                    <h3>OceanERP Bridge</h3>
                    <p>Copiez ce token dans OceanERP, menu Parametres &gt; PrestaShop, sur la connexion de la boutique. Il ne doit pas etre place dans le fichier .env.</p>
                    <div class="form-group">
                        <label for="OCEANERP_BRIDGE_TOKEN">Token de securite</label>
                        <input id="OCEANERP_BRIDGE_TOKEN" name="OCEANERP_BRIDGE_TOKEN" class="form-control" value="' . $token . '" />
                    </div>
                    <button type="submit" name="submitOceanerpBridge" class="btn btn-primary">Enregistrer</button>
                </div>
                <div class="panel">
                    <h3>Endpoints etiquette Colissimo</h3>
                    <p>OceanERP les tente automatiquement si le token est renseigne. Si votre boutique utilise une configuration particuliere, copiez une des URLs ci-dessous dans le champ URL etiquette Colissimo de la connexion PrestaShop.</p>
                    <div class="form-group">
                        <label>Endpoint direct</label>
                        <input class="form-control" readonly value="' . $directEndpoint . '" />
                    </div>
                    <div class="form-group">
                        <label>Endpoint front-controller</label>
                        <input class="form-control" readonly value="' . $frontEndpoint . '" />
                    </div>
                    <p class="help-block">Le pont cherche dans les tables et dossiers contenant Colissimo, y compris les chemins, JSON, XML, contenu base64 PDF/ZIP/ZPL et fichiers locaux rattaches a la commande.</p>
                </div>
            </form>';
    }

    private function defaultToken()
    {
        try {
            return bin2hex(random_bytes(32));
        } catch (Exception $exception) {
            return Tools::passwdGen(64);
        }
    }
}
