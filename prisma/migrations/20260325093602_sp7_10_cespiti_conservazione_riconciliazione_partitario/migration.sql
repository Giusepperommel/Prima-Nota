-- AlterTable
ALTER TABLE `quote_ammortamento` ADD COLUMN `fondo_progressivo_fiscale` DECIMAL(10, 2) NULL,
    ADD COLUMN `importo_quota_fiscale` DECIMAL(10, 2) NULL;

-- CreateTable
CREATE TABLE `pacchetti_conservazione` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `tipo` ENUM('FATTURE_ATTIVE', 'FATTURE_PASSIVE', 'LIBRO_GIORNALE', 'REGISTRI_IVA') NOT NULL,
    `stato` ENUM('GENERATO', 'FIRMATO', 'CONSERVATO') NOT NULL DEFAULT 'GENERATO',
    `hash_sha256` VARCHAR(64) NOT NULL,
    `marca_temporale` DATETIME(3) NULL,
    `firma_digitale` TEXT NULL,
    `file_contenuto` LONGTEXT NULL,
    `metadati_xml` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pacchetti_conservazione_societa_id_anno_idx`(`societa_id`, `anno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimenti_bancari` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `data` DATE NOT NULL,
    `descrizione` TEXT NOT NULL,
    `importo` DECIMAL(12, 2) NOT NULL,
    `segno` ENUM('DARE', 'AVERE') NOT NULL,
    `saldo` DECIMAL(12, 2) NULL,
    `riferimento_esterno` VARCHAR(100) NULL,
    `riconciliato_con_operazione_id` INTEGER NULL,
    `stato_riconciliazione` ENUM('NON_RICONCILIATO', 'RICONCILIATO', 'PARZIALE') NOT NULL DEFAULT 'NON_RICONCILIATO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `movimenti_bancari_societa_id_data_idx`(`societa_id`, `data`),
    INDEX `movimenti_bancari_stato_riconciliazione_idx`(`stato_riconciliazione`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scadenze_partitario` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anagrafica_id` INTEGER NOT NULL,
    `operazione_id` INTEGER NULL,
    `data_scadenza` DATE NOT NULL,
    `importo` DECIMAL(12, 2) NOT NULL,
    `importo_pagato` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `stato` ENUM('APERTA', 'PARZIALE', 'CHIUSA') NOT NULL DEFAULT 'APERTA',
    `tipo` ENUM('CLIENTE', 'FORNITORE') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scadenze_partitario_societa_id_anagrafica_id_idx`(`societa_id`, `anagrafica_id`),
    INDEX `scadenze_partitario_data_scadenza_idx`(`data_scadenza`),
    INDEX `scadenze_partitario_stato_idx`(`stato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `pacchetti_conservazione` ADD CONSTRAINT `pacchetti_conservazione_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimenti_bancari` ADD CONSTRAINT `movimenti_bancari_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimenti_bancari` ADD CONSTRAINT `movimenti_bancari_riconciliato_con_operazione_id_fkey` FOREIGN KEY (`riconciliato_con_operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scadenze_partitario` ADD CONSTRAINT `scadenze_partitario_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scadenze_partitario` ADD CONSTRAINT `scadenze_partitario_anagrafica_id_fkey` FOREIGN KEY (`anagrafica_id`) REFERENCES `anagrafiche`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scadenze_partitario` ADD CONSTRAINT `scadenze_partitario_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
