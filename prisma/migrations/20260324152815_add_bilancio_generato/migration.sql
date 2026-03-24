-- CreateTable
CREATE TABLE `bilanci_generati` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `data_generazione` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tipo` VARCHAR(20) NOT NULL DEFAULT 'ORDINARIO',
    `dati_sp` JSON NOT NULL,
    `dati_ce` JSON NOT NULL,
    `totale_attivo` DECIMAL(14, 2) NOT NULL,
    `totale_passivo` DECIMAL(14, 2) NOT NULL,
    `utile_esercizio` DECIMAL(14, 2) NOT NULL,

    UNIQUE INDEX `bilanci_generati_societa_id_anno_key`(`societa_id`, `anno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bilanci_generati` ADD CONSTRAINT `bilanci_generati_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
