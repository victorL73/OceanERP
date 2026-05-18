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
        $this->version = '0.1.0';
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
        return $output . '
            <form method="post">
                <div class="panel">
                    <h3>OceanERP Bridge</h3>
                    <p>Copiez ce token dans la variable PRESTASHOP_COLISSIMO_BRIDGE_TOKEN de OceanERP.</p>
                    <div class="form-group">
                        <label for="OCEANERP_BRIDGE_TOKEN">Token de securite</label>
                        <input id="OCEANERP_BRIDGE_TOKEN" name="OCEANERP_BRIDGE_TOKEN" class="form-control" value="' . $token . '" />
                    </div>
                    <button type="submit" name="submitOceanerpBridge" class="btn btn-primary">Enregistrer</button>
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
