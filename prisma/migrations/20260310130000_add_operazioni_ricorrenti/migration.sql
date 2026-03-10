-- AlterTable
ALTER TABLE `operazioni` ADD COLUMN `aliquota_iva` DECIMAL(5, 2) NULL,
    ADD COLUMN `bozza` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `importo_imponibile` DECIMAL(10, 2) NULL,
    ADD COLUMN `importo_iva` DECIMAL(10, 2) NULL,
    ADD COLUMN `operazione_ricorrente_id` INTEGER NULL,
    MODIFY `tipo_operazione` ENUM('FATTURA_ATTIVA', 'COSTO', 'CESPITE') NOT NULL;

-- CreateTable
CREATE TABLE `operazioni_ricorrenti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `created_by_user_id` INTEGER NOT NULL,
    `attiva` BOOLEAN NOT NULL DEFAULT true,
    `tipo_operazione` ENUM('FATTURA_ATTIVA', 'COSTO', 'CESPITE') NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `descrizione` TEXT NOT NULL,
    `importo_totale` DECIMAL(10, 2) NOT NULL,
    `aliquota_iva` DECIMAL(5, 2) NULL,
    `importo_imponibile` DECIMAL(10, 2) NULL,
    `importo_iva` DECIMAL(10, 2) NULL,
    `percentuale_detraibilita_iva` DECIMAL(5, 2) NULL,
    `iva_detraibile` DECIMAL(10, 2) NULL,
    `iva_indetraibile` DECIMAL(10, 2) NULL,
    `opzione_uso` VARCHAR(50) NULL,
    `percentuale_deducibilita` DECIMAL(5, 2) NOT NULL,
    `importo_deducibile` DECIMAL(10, 2) NOT NULL,
    `deducibilita_custom` BOOLEAN NOT NULL DEFAULT false,
    `tipo_ripartizione` ENUM('COMUNE', 'SINGOLO', 'CUSTOM') NOT NULL,
    `socio_singolo_id` INTEGER NULL,
    `note` TEXT NULL,
    `giorno_del_mese` INTEGER NOT NULL,
    `data_inizio` DATE NOT NULL,
    `data_fine` DATE NULL,
    `prossima_generazione` DATE NOT NULL,
    `tipo_contratto` ENUM('LEASING', 'NOLEGGIO_LUNGO_TERMINE') NULL,
    `valore_bene` DECIMAL(10, 2) NULL,
    `maxicanone` DECIMAL(10, 2) NULL,
    `durata_contratto` INTEGER NULL,
    `quota_servizi` DECIMAL(10, 2) NULL,
    `rate_rimanenti` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `operazioni_ricorrenti_societa_id_attiva_idx`(`societa_id`, `attiva`),
    INDEX `operazioni_ricorrenti_prossima_generazione_idx`(`prossima_generazione`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `operazioni_operazione_ricorrente_id_idx` ON `operazioni`(`operazione_ricorrente_id`);

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_operazione_ricorrente_id_fkey` FOREIGN KEY (`operazione_ricorrente_id`) REFERENCES `operazioni_ricorrenti`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni_ricorrenti` ADD CONSTRAINT `operazioni_ricorrenti_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni_ricorrenti` ADD CONSTRAINT `operazioni_ricorrenti_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorie_spesa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni_ricorrenti` ADD CONSTRAINT `operazioni_ricorrenti_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
