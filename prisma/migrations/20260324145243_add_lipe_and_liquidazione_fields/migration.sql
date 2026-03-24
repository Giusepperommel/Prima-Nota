-- AlterTable
ALTER TABLE `liquidazioni_iva` ADD COLUMN `crediti_imposta` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `credito_anno_precedente` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `data_stampa_definitiva` DATETIME(3) NULL,
    ADD COLUMN `debito_periodo_precedente` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `interessi_dovuti` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `metodo_acconto` INTEGER NULL,
    ADD COLUMN `stampa_definitiva` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `totale_operazioni_attive` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `totale_operazioni_passive` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `versamenti_auto_ue` DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `lipe_invii` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `trimestre` INTEGER NOT NULL,
    `xml_content` LONGTEXT NOT NULL,
    `nome_file` VARCHAR(50) NOT NULL,
    `progressivo_file` VARCHAR(5) NOT NULL,
    `stato` ENUM('BOZZA', 'GENERATA', 'INVIATA') NOT NULL DEFAULT 'GENERATA',
    `data_generazione` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `data_invio` DATETIME(3) NULL,
    `scadenza_invio` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lipe_invii_societa_id_anno_trimestre_key`(`societa_id`, `anno`, `trimestre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lipe_invii` ADD CONSTRAINT `lipe_invii_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
