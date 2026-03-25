-- CreateTable
CREATE TABLE `scadenze_fiscali` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('F24_IVA', 'F24_RITENUTE', 'F24_ACCONTO_IRES', 'F24_ACCONTO_IRPEF', 'LIPE', 'CU', 'DICHIARAZIONE_IVA', 'DICHIARAZIONE_770', 'REDDITI', 'IRAP', 'BILANCIO_DEPOSITO', 'DIRITTO_CCIAA', 'ACCONTO_IVA', 'CONSERVAZIONE') NOT NULL,
    `anno` INTEGER NOT NULL,
    `periodo` INTEGER NULL,
    `scadenza` DATE NOT NULL,
    `stato` ENUM('NON_INIZIATA', 'IN_PREPARAZIONE', 'PRONTA', 'COMPLETATA', 'SCADUTA') NOT NULL DEFAULT 'NON_INIZIATA',
    `percentuale_completamento` INTEGER NOT NULL DEFAULT 0,
    `entity_generata_id` INTEGER NULL,
    `entity_generata_tipo` VARCHAR(50) NULL,
    `bloccata_da` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `scadenze_fiscali_societa_id_scadenza_idx`(`societa_id`, `scadenza`),
    INDEX `scadenze_fiscali_stato_idx`(`stato`),
    UNIQUE INDEX `scadenze_fiscali_societa_id_tipo_anno_periodo_key`(`societa_id`, `tipo`, `anno`, `periodo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_adempimenti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `scadenza_fiscale_id` INTEGER NOT NULL,
    `ordine` INTEGER NOT NULL,
    `descrizione` VARCHAR(255) NOT NULL,
    `verifica_automatica` BOOLEAN NOT NULL DEFAULT false,
    `query_verifica` VARCHAR(100) NULL,
    `completata` BOOLEAN NOT NULL DEFAULT false,
    `completata_at` DATETIME(3) NULL,

    INDEX `checklist_adempimenti_scadenza_fiscale_id_idx`(`scadenza_fiscale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `scadenze_fiscali` ADD CONSTRAINT `scadenze_fiscali_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_adempimenti` ADD CONSTRAINT `checklist_adempimenti_scadenza_fiscale_id_fkey` FOREIGN KEY (`scadenza_fiscale_id`) REFERENCES `scadenze_fiscali`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
