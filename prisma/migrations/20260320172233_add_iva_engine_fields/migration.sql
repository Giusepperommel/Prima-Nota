-- AlterTable
ALTER TABLE `operazioni` ADD COLUMN `doppia_registrazione` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `operazione_origine_id` INTEGER NULL,
    ADD COLUMN `protocollo_iva_vendite` VARCHAR(20) NULL,
    ADD COLUMN `tipo_merce` ENUM('BENI', 'SERVIZI') NULL;

-- CreateTable
CREATE TABLE `plafond` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `metodo` ENUM('FISSO', 'MOBILE') NOT NULL DEFAULT 'FISSO',
    `importoDisponibile` DECIMAL(12, 2) NOT NULL,
    `importoUtilizzato` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `plafond_societa_id_anno_key`(`societa_id`, `anno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `movimento_plafond` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `plafond_id` INTEGER NOT NULL,
    `operazione_id` INTEGER NOT NULL,
    `importo` DECIMAL(12, 2) NOT NULL,
    `data_operazione` DATE NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `operazioni` ADD CONSTRAINT `operazioni_operazione_origine_id_fkey` FOREIGN KEY (`operazione_origine_id`) REFERENCES `operazioni`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `plafond` ADD CONSTRAINT `plafond_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimento_plafond` ADD CONSTRAINT `movimento_plafond_plafond_id_fkey` FOREIGN KEY (`plafond_id`) REFERENCES `plafond`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `movimento_plafond` ADD CONSTRAINT `movimento_plafond_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
