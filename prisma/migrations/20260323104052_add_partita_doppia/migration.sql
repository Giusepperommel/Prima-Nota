-- AlterTable
ALTER TABLE `categorie_spesa` ADD COLUMN `conto_default_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `scritture_contabili` (
    `scrittura_id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `operazione_id` INTEGER NULL,
    `data_registrazione` DATE NOT NULL,
    `data_competenza` DATE NOT NULL,
    `numero_protocollo` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `descrizione` VARCHAR(500) NOT NULL,
    `causale` VARCHAR(10) NOT NULL,
    `tipo_scrittura` ENUM('AUTO', 'MANUALE', 'RETTIFICA', 'STORNO', 'CHIUSURA', 'APERTURA') NOT NULL,
    `stato` ENUM('DEFINITIVA', 'PROVVISORIA') NOT NULL,
    `eliminato` BOOLEAN NOT NULL DEFAULT false,
    `protocollo_iva` INTEGER NULL,
    `registro_iva_sezionale` VARCHAR(10) NULL,
    `totale_dare` DECIMAL(12, 2) NOT NULL,
    `totale_avere` DECIMAL(12, 2) NOT NULL,
    `created_by_user_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scritture_contabili_societa_id_data_registrazione_idx`(`societa_id`, `data_registrazione`),
    INDEX `scritture_contabili_operazione_id_idx`(`operazione_id`),
    INDEX `scritture_contabili_societa_id_anno_causale_idx`(`societa_id`, `anno`, `causale`),
    UNIQUE INDEX `scritture_contabili_societa_id_anno_numero_protocollo_key`(`societa_id`, `anno`, `numero_protocollo`),
    PRIMARY KEY (`scrittura_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimenti_contabili` (
    `movimento_id` INTEGER NOT NULL AUTO_INCREMENT,
    `scrittura_id` INTEGER NOT NULL,
    `societa_id` INTEGER NOT NULL,
    `conto_id` INTEGER NOT NULL,
    `importo_dare` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `importo_avere` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `descrizione` VARCHAR(255) NULL,
    `ordine` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `movimenti_contabili_scrittura_id_idx`(`scrittura_id`),
    INDEX `movimenti_contabili_conto_id_idx`(`conto_id`),
    INDEX `movimenti_contabili_societa_id_conto_id_idx`(`societa_id`, `conto_id`),
    PRIMARY KEY (`movimento_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `causali_contabili` (
    `codice` VARCHAR(10) NOT NULL,
    `descrizione` VARCHAR(100) NOT NULL,
    `tipo_operazione` VARCHAR(50) NULL,
    `registro_iva` ENUM('VENDITE', 'ACQUISTI', 'CORRISPETTIVI') NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`codice`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `categorie_spesa` ADD CONSTRAINT `categorie_spesa_conto_default_id_fkey` FOREIGN KEY (`conto_default_id`) REFERENCES `piano_dei_conti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scritture_contabili` ADD CONSTRAINT `scritture_contabili_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scritture_contabili` ADD CONSTRAINT `scritture_contabili_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scritture_contabili` ADD CONSTRAINT `scritture_contabili_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `utenti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimenti_contabili` ADD CONSTRAINT `movimenti_contabili_scrittura_id_fkey` FOREIGN KEY (`scrittura_id`) REFERENCES `scritture_contabili`(`scrittura_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimenti_contabili` ADD CONSTRAINT `movimenti_contabili_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimenti_contabili` ADD CONSTRAINT `movimenti_contabili_conto_id_fkey` FOREIGN KEY (`conto_id`) REFERENCES `piano_dei_conti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
