-- CreateTable
CREATE TABLE `f24_versamenti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `mese` INTEGER NOT NULL,
    `data_scadenza` DATE NOT NULL,
    `data_pagamento` DATE NULL,
    `stato` ENUM('DA_PAGARE', 'PAGATO', 'SCADUTO') NOT NULL DEFAULT 'DA_PAGARE',
    `totale_debito` DECIMAL(12, 2) NOT NULL,
    `totale_credito` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `totale_versamento` DECIMAL(12, 2) NOT NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `f24_versamenti_societa_id_anno_mese_idx`(`societa_id`, `anno`, `mese`),
    INDEX `f24_versamenti_societa_id_stato_idx`(`societa_id`, `stato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `f24_righe` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `f24_versamento_id` INTEGER NOT NULL,
    `sezione` ENUM('ERARIO', 'INPS', 'REGIONI_ENTI_LOCALI') NOT NULL,
    `codice_tributo` VARCHAR(10) NOT NULL,
    `rateazione` VARCHAR(4) NULL,
    `anno_riferimento` INTEGER NOT NULL,
    `periodo_riferimento` VARCHAR(4) NULL,
    `importo_debito` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `importo_credito` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `descrizione` VARCHAR(255) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `certificazioni_uniche` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `anagrafica_id` INTEGER NOT NULL,
    `causale_cu` VARCHAR(2) NOT NULL,
    `ammontare_lordo` DECIMAL(12, 2) NOT NULL,
    `imponibile` DECIMAL(12, 2) NOT NULL,
    `ritenuta_acconto` DECIMAL(12, 2) NOT NULL,
    `rivalsa_inps` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `cassa_previdenza` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `stato` ENUM('BOZZA', 'GENERATA', 'INVIATA') NOT NULL DEFAULT 'BOZZA',
    `data_generazione` DATETIME(3) NULL,
    `data_invio` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `certificazioni_uniche_societa_id_anno_idx`(`societa_id`, `anno`),
    UNIQUE INDEX `certificazioni_uniche_societa_id_anno_anagrafica_id_key`(`societa_id`, `anno`, `anagrafica_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dichiarazioni_fiscali` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `tipo` ENUM('REDDITI_SC', 'IRAP', 'MOD_770') NOT NULL,
    `stato` ENUM('NON_INIZIATA', 'IN_PREPARAZIONE', 'GENERATA', 'INVIATA') NOT NULL DEFAULT 'NON_INIZIATA',
    `dati_calcolo` JSON NULL,
    `data_generazione` DATETIME(3) NULL,
    `data_invio` DATETIME(3) NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `dichiarazioni_fiscali_societa_id_anno_idx`(`societa_id`, `anno`),
    UNIQUE INDEX `dichiarazioni_fiscali_societa_id_anno_tipo_key`(`societa_id`, `anno`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `f24_versamenti` ADD CONSTRAINT `f24_versamenti_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `f24_righe` ADD CONSTRAINT `f24_righe_f24_versamento_id_fkey` FOREIGN KEY (`f24_versamento_id`) REFERENCES `f24_versamenti`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificazioni_uniche` ADD CONSTRAINT `certificazioni_uniche_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificazioni_uniche` ADD CONSTRAINT `certificazioni_uniche_anagrafica_id_fkey` FOREIGN KEY (`anagrafica_id`) REFERENCES `anagrafiche`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dichiarazioni_fiscali` ADD CONSTRAINT `dichiarazioni_fiscali_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
