-- CreateTable
CREATE TABLE `anomalie` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('QUADRATURA', 'DUPLICATO', 'COMPLIANCE', 'DOCUMENTALE', 'SCADENZA', 'CATEGORIA_ANOMALA', 'REGIME_IVA_SOSPETTO', 'INCOERENZA_SEMANTICA') NOT NULL,
    `sorgente` ENUM('REGOLA', 'PATTERN', 'AI') NOT NULL,
    `priorita` ENUM('CRITICA', 'ALTA', 'MEDIA', 'BASSA') NOT NULL,
    `titolo` VARCHAR(255) NOT NULL,
    `descrizione` TEXT NOT NULL,
    `entity_type` VARCHAR(50) NULL,
    `entity_id` INTEGER NULL,
    `stato` ENUM('APERTA', 'RISOLTA', 'IGNORATA', 'FALSO_POSITIVO') NOT NULL DEFAULT 'APERTA',
    `risolta_da` INTEGER NULL,
    `risolta_at` DATETIME(3) NULL,
    `metadati` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `anomalie_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `anomalie_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `health_scores` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `mese` INTEGER NOT NULL,
    `area_contabilita` INTEGER NOT NULL,
    `area_iva` INTEGER NOT NULL,
    `area_scadenze` INTEGER NOT NULL,
    `area_documentale` INTEGER NOT NULL,
    `area_banca` INTEGER NOT NULL,
    `score_complessivo` INTEGER NOT NULL,
    `calcolato_at` DATETIME(3) NOT NULL,

    INDEX `health_scores_societa_id_idx`(`societa_id`),
    UNIQUE INDEX `health_scores_societa_id_anno_mese_key`(`societa_id`, `anno`, `mese`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `anomalie` ADD CONSTRAINT `anomalie_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `health_scores` ADD CONSTRAINT `health_scores_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
