-- CreateTable
CREATE TABLE `cespiti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operazione_id` INTEGER NOT NULL,
    `societa_id` INTEGER NOT NULL,
    `descrizione` TEXT NOT NULL,
    `valore_iniziale` DECIMAL(10, 2) NOT NULL,
    `aliquota_ammortamento` DECIMAL(5, 2) NOT NULL,
    `data_acquisto` DATE NOT NULL,
    `anno_inizio` INTEGER NOT NULL,
    `stato` ENUM('IN_AMMORTAMENTO', 'COMPLETATO', 'CEDUTO') NOT NULL DEFAULT 'IN_AMMORTAMENTO',
    `fondo_ammortamento` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `cespiti_operazione_id_key`(`operazione_id`),
    INDEX `cespiti_societa_id_idx`(`societa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote_ammortamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `cespite_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `aliquota_applicata` DECIMAL(5, 2) NOT NULL,
    `importo_quota` DECIMAL(10, 2) NOT NULL,
    `fondo_progressivo` DECIMAL(10, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `quote_ammortamento_cespite_id_idx`(`cespite_id`),
    INDEX `quote_ammortamento_anno_idx`(`anno`),
    UNIQUE INDEX `quote_ammortamento_cespite_id_anno_key`(`cespite_id`, `anno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `cespiti` ADD CONSTRAINT `cespiti_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cespiti` ADD CONSTRAINT `cespiti_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quote_ammortamento` ADD CONSTRAINT `quote_ammortamento_cespite_id_fkey` FOREIGN KEY (`cespite_id`) REFERENCES `cespiti`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
