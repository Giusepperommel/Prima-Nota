-- AlterTable: Change regime_fiscale from VARCHAR to enum, add tipo_attivita
ALTER TABLE `societa` ADD COLUMN `tipo_attivita` ENUM('SRL', 'SRLS', 'SNC', 'SAS', 'STP', 'DITTA_INDIVIDUALE', 'LIBERO_PROFESSIONISTA', 'AGENTE_COMMERCIO') NOT NULL DEFAULT 'SRL';

-- Update existing regime_fiscale values to match enum
UPDATE `societa` SET `regime_fiscale` = 'ORDINARIO' WHERE `regime_fiscale` IS NOT NULL;

ALTER TABLE `societa` MODIFY COLUMN `regime_fiscale` ENUM('ORDINARIO', 'FORFETTARIO') NOT NULL DEFAULT 'ORDINARIO';

-- AlterTable: Add IVA fields to categorie_spesa
ALTER TABLE `categorie_spesa` ADD COLUMN `aliquota_iva_default` DECIMAL(5, 2) NOT NULL DEFAULT 22,
    ADD COLUMN `percentuale_detraibilita_iva` DECIMAL(5, 2) NOT NULL DEFAULT 100,
    ADD COLUMN `ha_opzioni_uso` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `opzioni_uso` JSON NULL;

-- AlterTable: Add IVA detraibilita fields to operazioni
ALTER TABLE `operazioni` ADD COLUMN `percentuale_detraibilita_iva` DECIMAL(5, 2) NULL,
    ADD COLUMN `iva_detraibile` DECIMAL(10, 2) NULL,
    ADD COLUMN `iva_indetraibile` DECIMAL(10, 2) NULL,
    ADD COLUMN `opzione_uso` VARCHAR(50) NULL;

-- CreateTable: preferenze_uso_categoria
CREATE TABLE `preferenze_uso_categoria` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `categoria_id` INTEGER NOT NULL,
    `opzione_uso` VARCHAR(50) NOT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `preferenze_uso_categoria_user_id_categoria_id_key`(`user_id`, `categoria_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `preferenze_uso_categoria` ADD CONSTRAINT `preferenze_uso_categoria_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `preferenze_uso_categoria` ADD CONSTRAINT `preferenze_uso_categoria_categoria_id_fkey` FOREIGN KEY (`categoria_id`) REFERENCES `categorie_spesa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
