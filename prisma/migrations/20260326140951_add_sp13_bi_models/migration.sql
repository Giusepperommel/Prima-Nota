-- CreateTable
CREATE TABLE `kpi_definizioni` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NULL,
    `codice` VARCHAR(50) NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `categoria` ENUM('ECONOMICO', 'FINANZIARIO', 'FISCALE', 'OPERATIVO', 'CRESCITA') NOT NULL,
    `formula` JSON NOT NULL,
    `conti_riferimento` JSON NULL,
    `soglia_semaforo` JSON NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `ordine` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kpi_definizioni_categoria_attivo_idx`(`categoria`, `attivo`),
    UNIQUE INDEX `kpi_definizioni_societa_id_codice_key`(`societa_id`, `codice`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kpi_valori` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `kpi_id` INTEGER NOT NULL,
    `periodo` VARCHAR(10) NOT NULL,
    `periodo_tipo` ENUM('MESE', 'TRIMESTRE', 'ANNO') NOT NULL,
    `valore` DOUBLE NOT NULL,
    `valore_prec` DOUBLE NULL,
    `variazione` DOUBLE NULL,
    `trend` VARCHAR(10) NULL,
    `calcolato_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `kpi_valori_societa_id_periodo_tipo_idx`(`societa_id`, `periodo_tipo`),
    UNIQUE INDEX `kpi_valori_societa_id_kpi_id_periodo_periodo_tipo_key`(`societa_id`, `kpi_id`, `periodo`, `periodo_tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `anno` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `stato` ENUM('BOZZA', 'APPROVATO') NOT NULL DEFAULT 'BOZZA',
    `approvato_da` INTEGER NULL,
    `approvato_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `budget_societa_id_anno_nome_key`(`societa_id`, `anno`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `budget_righe` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `budget_id` INTEGER NOT NULL,
    `conto_id` INTEGER NOT NULL,
    `mese` INTEGER NOT NULL,
    `importo` DECIMAL(12, 2) NOT NULL,

    UNIQUE INDEX `budget_righe_budget_id_conto_id_mese_key`(`budget_id`, `conto_id`, `mese`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_templates` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NULL,
    `nome` VARCHAR(100) NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `sezioni` JSON NOT NULL,
    `formato` VARCHAR(10) NOT NULL DEFAULT 'PDF',
    `schedulazione` VARCHAR(50) NULL,
    `destinatari` JSON NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_generati_bi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `template_id` INTEGER NOT NULL,
    `periodo` VARCHAR(20) NOT NULL,
    `dati` JSON NOT NULL,
    `narrativa_ai` TEXT NULL,
    `file_url` TEXT NULL,
    `stato` ENUM('PENDING', 'GENERATO', 'ERRORE') NOT NULL DEFAULT 'PENDING',
    `generato_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `report_generati_bi_societa_id_generato_at_idx`(`societa_id`, `generato_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `kpi_definizioni` ADD CONSTRAINT `kpi_definizioni_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kpi_valori` ADD CONSTRAINT `kpi_valori_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kpi_valori` ADD CONSTRAINT `kpi_valori_kpi_id_fkey` FOREIGN KEY (`kpi_id`) REFERENCES `kpi_definizioni`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budget` ADD CONSTRAINT `budget_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budget_righe` ADD CONSTRAINT `budget_righe_budget_id_fkey` FOREIGN KEY (`budget_id`) REFERENCES `budget`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `budget_righe` ADD CONSTRAINT `budget_righe_conto_id_fkey` FOREIGN KEY (`conto_id`) REFERENCES `piano_dei_conti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_templates` ADD CONSTRAINT `report_templates_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_generati_bi` ADD CONSTRAINT `report_generati_bi_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_generati_bi` ADD CONSTRAINT `report_generati_bi_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `report_templates`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
