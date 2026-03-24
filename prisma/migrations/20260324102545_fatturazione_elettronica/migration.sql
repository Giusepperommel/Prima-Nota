-- AlterTable
ALTER TABLE `societa` ADD COLUMN `cap` VARCHAR(5) NULL,
    ADD COLUMN `citta` VARCHAR(60) NULL,
    ADD COLUMN `email_azienda` VARCHAR(255) NULL,
    ADD COLUMN `nazione` VARCHAR(2) NULL DEFAULT 'IT',
    ADD COLUMN `provincia` VARCHAR(2) NULL,
    ADD COLUMN `rea_numero` VARCHAR(20) NULL,
    ADD COLUMN `rea_ufficio` VARCHAR(2) NULL,
    ADD COLUMN `socio_unico` VARCHAR(2) NULL,
    ADD COLUMN `stato_liquidazione` VARCHAR(2) NULL DEFAULT 'LN',
    ADD COLUMN `telefono_azienda` VARCHAR(20) NULL;

-- CreateTable
CREATE TABLE `fatture_elettroniche` (
    `fattura_elettronica_id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `operazione_id` INTEGER NOT NULL,
    `sezionale_id` INTEGER NOT NULL,
    `numero` VARCHAR(20) NOT NULL,
    `anno_riferimento` INTEGER NOT NULL,
    `progressivo_file` VARCHAR(5) NOT NULL,
    `nome_file` VARCHAR(50) NOT NULL,
    `stato` ENUM('BOZZA', 'GENERATA', 'INVIATA', 'CONSEGNATA', 'SCARTATA', 'MANCATA_CONSEGNA', 'IMPOSSIBILITA_RECAPITO', 'ANNULLATA') NOT NULL DEFAULT 'GENERATA',
    `tipo_documento` ENUM('TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD07', 'TD08', 'TD09', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD21', 'TD22', 'TD23', 'TD24', 'TD25', 'TD26', 'TD27', 'TD28', 'TD29') NOT NULL,
    `xml_content` LONGTEXT NOT NULL,
    `xml_hash` VARCHAR(64) NULL,
    `importo_totale` DECIMAL(12, 2) NOT NULL,
    `data_documento` DATE NOT NULL,
    `data_generazione` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `data_invio` DATETIME(3) NULL,
    `data_esito_sdi` DATETIME(3) NULL,
    `identificativo_sdi` VARCHAR(50) NULL,
    `errori_sdi` TEXT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fatture_elettroniche_operazione_id_key`(`operazione_id`),
    INDEX `fatture_elettroniche_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `fatture_elettroniche_societa_id_anno_riferimento_idx`(`societa_id`, `anno_riferimento`),
    UNIQUE INDEX `fatture_elettroniche_societa_id_sezionale_id_anno_riferiment_key`(`societa_id`, `sezionale_id`, `anno_riferimento`, `numero`),
    UNIQUE INDEX `fatture_elettroniche_societa_id_nome_file_key`(`societa_id`, `nome_file`),
    PRIMARY KEY (`fattura_elettronica_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sezionali_fattura` (
    `sezionale_id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `codice` VARCHAR(10) NOT NULL,
    `descrizione` VARCHAR(100) NOT NULL,
    `prefisso` VARCHAR(10) NOT NULL,
    `separatore` VARCHAR(5) NOT NULL DEFAULT '/',
    `tipi_documento` JSON NOT NULL,
    `ultimo_numero` INTEGER NOT NULL DEFAULT 0,
    `numero_iniziale` INTEGER NOT NULL DEFAULT 1,
    `anno_corrente` INTEGER NOT NULL,
    `formato` VARCHAR(50) NOT NULL DEFAULT '{prefisso}{numero}',
    `padding_cifre` INTEGER NOT NULL DEFAULT 1,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `predefinito` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sezionali_fattura_societa_id_attivo_idx`(`societa_id`, `attivo`),
    UNIQUE INDEX `sezionali_fattura_societa_id_codice_key`(`societa_id`, `codice`),
    PRIMARY KEY (`sezionale_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `configurazione_provider` (
    `config_id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `provider` VARCHAR(30) NOT NULL DEFAULT 'MANUALE',
    `attivo` BOOLEAN NOT NULL DEFAULT false,
    `configurazione` JSON NULL,
    `ultimo_test` DATETIME(3) NULL,
    `esito_test` BOOLEAN NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `configurazione_provider_societa_id_key`(`societa_id`),
    PRIMARY KEY (`config_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `fatture_elettroniche` ADD CONSTRAINT `fatture_elettroniche_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatture_elettroniche` ADD CONSTRAINT `fatture_elettroniche_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatture_elettroniche` ADD CONSTRAINT `fatture_elettroniche_sezionale_id_fkey` FOREIGN KEY (`sezionale_id`) REFERENCES `sezionali_fattura`(`sezionale_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `fatture_elettroniche` ADD CONSTRAINT `fatture_elettroniche_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sezionali_fattura` ADD CONSTRAINT `sezionali_fattura_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configurazione_provider` ADD CONSTRAINT `configurazione_provider_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
