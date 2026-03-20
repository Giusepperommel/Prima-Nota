/*
  Warnings:

  - A unique constraint covering the columns `[societa_id,protocollo_iva]` on the table `operazioni` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `operazioni` ADD COLUMN `bollo_virtuale` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `cliente_id` INTEGER NULL,
    ADD COLUMN `codice_conto_id` INTEGER NULL,
    ADD COLUMN `data_competenza_fine` DATE NULL,
    ADD COLUMN `data_competenza_inizio` DATE NULL,
    ADD COLUMN `data_pagamento` DATE NULL,
    ADD COLUMN `data_registrazione` DATE NULL,
    ADD COLUMN `fornitore_id` INTEGER NULL,
    ADD COLUMN `importo_bollo` DECIMAL(5, 2) NULL,
    ADD COLUMN `importo_netto_ritenuta` DECIMAL(10, 2) NULL,
    ADD COLUMN `importo_pagato` DECIMAL(10, 2) NULL,
    ADD COLUMN `importo_ritenuta` DECIMAL(10, 2) NULL,
    ADD COLUMN `natura_operazione_iva` ENUM('N1', 'N2_1', 'N2_2', 'N3_1', 'N3_2', 'N3_3', 'N3_4', 'N3_5', 'N3_6', 'N4', 'N5', 'N6_1', 'N6_2', 'N6_3', 'N6_4', 'N6_5', 'N6_6', 'N6_7', 'N6_8', 'N6_9', 'N7') NULL,
    ADD COLUMN `protocollo_iva` VARCHAR(20) NULL,
    ADD COLUMN `rateo_risconto_id` INTEGER NULL,
    ADD COLUMN `registro_iva` ENUM('VENDITE', 'ACQUISTI', 'CORRISPETTIVI') NULL,
    ADD COLUMN `soggetto_a_ritenuta` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `split_payment` BOOLEAN NULL,
    ADD COLUMN `stato_pagamento_fattura` ENUM('NON_PAGATO', 'PAGATO', 'PARZIALMENTE_PAGATO') NULL,
    ADD COLUMN `tipo_documento_sdi` ENUM('TD01', 'TD02', 'TD03', 'TD04', 'TD05', 'TD06', 'TD07', 'TD08', 'TD09', 'TD16', 'TD17', 'TD18', 'TD19', 'TD20', 'TD21', 'TD22', 'TD23', 'TD24', 'TD25', 'TD26', 'TD27', 'TD28', 'TD29') NULL;

-- AlterTable
ALTER TABLE `utenti` ADD COLUMN `modalita_avanzata` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `modalita_commercialista` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `anagrafiche` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `denominazione` VARCHAR(255) NOT NULL,
    `partita_iva` VARCHAR(11) NULL,
    `codice_fiscale` VARCHAR(16) NULL,
    `tipo_soggetto` ENUM('AZIENDA', 'PERSONA_FISICA', 'PROFESSIONISTA') NOT NULL,
    `tipo` ENUM('FORNITORE', 'CLIENTE', 'ENTRAMBI') NOT NULL,
    `indirizzo` VARCHAR(255) NULL,
    `cap` VARCHAR(10) NULL,
    `citta` VARCHAR(100) NULL,
    `provincia` VARCHAR(2) NULL,
    `nazione` VARCHAR(2) NULL DEFAULT 'IT',
    `codice_destinatario` VARCHAR(7) NULL,
    `pec` VARCHAR(255) NULL,
    `regime_fiscale` VARCHAR(4) NULL,
    `soggetto_a_ritenuta` BOOLEAN NOT NULL DEFAULT false,
    `regime_forfettario` BOOLEAN NOT NULL DEFAULT false,
    `tipo_ritenuta` ENUM('LAVORO_AUTONOMO', 'PROVVIGIONI', 'OCCASIONALE', 'DIRITTI_AUTORE') NULL,
    `auto_creata_ocr` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `anagrafiche_societa_id_partita_iva_key`(`societa_id`, `partita_iva`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `piano_dei_conti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `codice` VARCHAR(10) NOT NULL,
    `descrizione` VARCHAR(255) NOT NULL,
    `tipo` ENUM('PATRIMONIALE_ATTIVO', 'PATRIMONIALE_PASSIVO', 'ECONOMICO_COSTO', 'ECONOMICO_RICAVO', 'ORDINE') NOT NULL,
    `voce_sp` VARCHAR(20) NULL,
    `voce_ce` VARCHAR(20) NULL,
    `natura_saldo` ENUM('DARE', 'AVERE') NOT NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `pre_configurato` BOOLEAN NOT NULL DEFAULT true,
    `modificabile` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `piano_dei_conti_societa_id_codice_key`(`societa_id`, `codice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ritenute` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `operazione_id` INTEGER NOT NULL,
    `anagrafica_id` INTEGER NOT NULL,
    `tipo_ritenuta` ENUM('LAVORO_AUTONOMO', 'PROVVIGIONI', 'OCCASIONALE', 'DIRITTI_AUTORE') NOT NULL,
    `aliquota` DECIMAL(5, 2) NOT NULL,
    `percentuale_imponibile` DECIMAL(5, 2) NOT NULL,
    `importo_lordo` DECIMAL(10, 2) NOT NULL,
    `base_imponibile` DECIMAL(10, 2) NOT NULL,
    `importo_ritenuta` DECIMAL(10, 2) NOT NULL,
    `importo_netto` DECIMAL(10, 2) NOT NULL,
    `rivalsa_inps` DECIMAL(10, 2) NULL,
    `cassa_previdenza` DECIMAL(10, 2) NULL,
    `mese_competenza` INTEGER NOT NULL,
    `anno_competenza` INTEGER NOT NULL,
    `codice_tributo` VARCHAR(4) NOT NULL,
    `data_versamento` DATETIME(3) NULL,
    `importo_versato` DECIMAL(10, 2) NULL,
    `stato_versamento` ENUM('DA_VERSARE', 'VERSATO', 'SCADUTO') NOT NULL DEFAULT 'DA_VERSARE',
    `cu_emessa` BOOLEAN NOT NULL DEFAULT false,
    `cu_data_emissione` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ritenute_operazione_id_key`(`operazione_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ratei_risconti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `chiusura_esercizio_id` INTEGER NOT NULL,
    `tipo` ENUM('RATEO_ATTIVO', 'RATEO_PASSIVO', 'RISCONTO_ATTIVO', 'RISCONTO_PASSIVO') NOT NULL,
    `descrizione` VARCHAR(255) NOT NULL,
    `importo_originario` DECIMAL(10, 2) NOT NULL,
    `data_inizio_competenza` DATE NOT NULL,
    `data_fine_competenza` DATE NOT NULL,
    `data_manifestazione_fin` DATE NOT NULL,
    `importo_calcolato` DECIMAL(10, 2) NOT NULL,
    `esercizio_riferimento` INTEGER NOT NULL,
    `voce_sp` VARCHAR(10) NULL,
    `conto_ce_collegato` VARCHAR(10) NULL,
    `automatico` BOOLEAN NOT NULL DEFAULT true,
    `stornato` BOOLEAN NOT NULL DEFAULT false,
    `storno_esercizio` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chiusure_esercizio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `data_apertura` DATE NOT NULL,
    `data_chiusura` DATE NOT NULL,
    `stato` ENUM('IN_CORSO', 'CHIUSO', 'APPROVATO') NOT NULL DEFAULT 'IN_CORSO',
    `saldo_banca_iniziale` DECIMAL(12, 2) NULL,
    `saldo_cassa_iniziale` DECIMAL(12, 2) NULL,
    `capitale_sociale` DECIMAL(12, 2) NULL,
    `riserva_legale` DECIMAL(12, 2) NULL,
    `riserva_statutaria` DECIMAL(12, 2) NULL,
    `riserva_straordinaria` DECIMAL(12, 2) NULL,
    `utili_perdite_portati_a_nuovo` DECIMAL(12, 2) NULL,
    `saldo_banca_finale` DECIMAL(12, 2) NULL,
    `saldo_cassa_finale` DECIMAL(12, 2) NULL,
    `risultato_esercizio` DECIMAL(12, 2) NULL,
    `data_creazione` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `data_chiusura_effettiva` DATETIME(3) NULL,

    UNIQUE INDEX `chiusure_esercizio_societa_id_anno_key`(`societa_id`, `anno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `liquidazioni_iva` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `chiusura_esercizio_id` INTEGER NULL,
    `tipo` ENUM('MENSILE', 'TRIMESTRALE') NOT NULL,
    `periodo` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `iva_esigibile` DECIMAL(12, 2) NOT NULL,
    `iva_detraibile` DECIMAL(12, 2) NOT NULL,
    `saldo` DECIMAL(12, 2) NOT NULL,
    `credito_periodo_precedente` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `acconto_versato` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `importo_versato` DECIMAL(12, 2) NULL,
    `codice_tributo` VARCHAR(4) NULL,
    `data_versamento` DATETIME(3) NULL,
    `stato_versamento` ENUM('DA_VERSARE', 'VERSATO', 'SCADUTO') NOT NULL DEFAULT 'DA_VERSARE',
    `lipe_inviata` BOOLEAN NOT NULL DEFAULT false,
    `lipe_data_invio` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `liquidazioni_iva_societa_id_tipo_periodo_anno_key`(`societa_id`, `tipo`, `periodo`, `anno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `operazioni_societa_id_protocollo_iva_key` ON `operazioni`(`societa_id`, `protocollo_iva`);

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_fornitore_id_fkey` FOREIGN KEY (`fornitore_id`) REFERENCES `anagrafiche`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_cliente_id_fkey` FOREIGN KEY (`cliente_id`) REFERENCES `anagrafiche`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_codice_conto_id_fkey` FOREIGN KEY (`codice_conto_id`) REFERENCES `piano_dei_conti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_rateo_risconto_id_fkey` FOREIGN KEY (`rateo_risconto_id`) REFERENCES `ratei_risconti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anagrafiche` ADD CONSTRAINT `anagrafiche_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `piano_dei_conti` ADD CONSTRAINT `piano_dei_conti_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ritenute` ADD CONSTRAINT `ritenute_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ritenute` ADD CONSTRAINT `ritenute_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ritenute` ADD CONSTRAINT `ritenute_anagrafica_id_fkey` FOREIGN KEY (`anagrafica_id`) REFERENCES `anagrafiche`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratei_risconti` ADD CONSTRAINT `ratei_risconti_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ratei_risconti` ADD CONSTRAINT `ratei_risconti_chiusura_esercizio_id_fkey` FOREIGN KEY (`chiusura_esercizio_id`) REFERENCES `chiusure_esercizio`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chiusure_esercizio` ADD CONSTRAINT `chiusure_esercizio_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `liquidazioni_iva` ADD CONSTRAINT `liquidazioni_iva_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `liquidazioni_iva` ADD CONSTRAINT `liquidazioni_iva_chiusura_esercizio_id_fkey` FOREIGN KEY (`chiusura_esercizio_id`) REFERENCES `chiusure_esercizio`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
