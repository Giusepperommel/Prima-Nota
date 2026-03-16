-- CreateTable
CREATE TABLE `preset_ripartizioni` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `tipi_operazione` JSON NOT NULL,
    `ordinamento` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `preset_ripartizioni_societa_id_ordinamento_idx`(`societa_id`, `ordinamento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `preset_ripartizioni_soci` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `preset_ripartizione_id` INTEGER NOT NULL,
    `socio_id` INTEGER NOT NULL,
    `percentuale` DECIMAL(5, 2) NOT NULL,

    INDEX `preset_ripartizioni_soci_preset_ripartizione_id_idx`(`preset_ripartizione_id`),
    INDEX `preset_ripartizioni_soci_socio_id_idx`(`socio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `preset_ripartizioni` ADD CONSTRAINT `preset_ripartizioni_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `preset_ripartizioni_soci` ADD CONSTRAINT `preset_ripartizioni_soci_preset_ripartizione_id_fkey` FOREIGN KEY (`preset_ripartizione_id`) REFERENCES `preset_ripartizioni`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `preset_ripartizioni_soci` ADD CONSTRAINT `preset_ripartizioni_soci_socio_id_fkey` FOREIGN KEY (`socio_id`) REFERENCES `soci`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
