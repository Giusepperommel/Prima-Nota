-- AlterTable
ALTER TABLE `notifiche` ADD COLUMN `cliente_destinatario_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `configurazione_portale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `portale_attivo` BOOLEAN NOT NULL DEFAULT false,
    `cliente_puo_caricare_fatture` BOOLEAN NOT NULL DEFAULT true,
    `cliente_vede_situazione_iva` BOOLEAN NOT NULL DEFAULT true,
    `cliente_vede_saldo` BOOLEAN NOT NULL DEFAULT false,
    `cliente_vede_scadenze` BOOLEAN NOT NULL DEFAULT true,
    `report_automatici` BOOLEAN NOT NULL DEFAULT false,
    `invio_email_automatico` BOOLEAN NOT NULL DEFAULT false,
    `firma_email` VARCHAR(500) NULL,
    `logo_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `configurazione_portale_societa_id_key`(`societa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accessi_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `ruolo` ENUM('TITOLARE', 'DELEGATO') NOT NULL,
    `ultimo_accesso` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accessi_cliente_societa_id_email_key`(`societa_id`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `richieste_documento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `accesso_cliente_id` INTEGER NOT NULL,
    `tipo` ENUM('FATTURE_MANCANTI', 'CONFERMA_DATI', 'DOMANDA', 'GENERICO') NOT NULL,
    `titolo` VARCHAR(255) NOT NULL,
    `messaggio` TEXT NOT NULL,
    `scadenza` DATE NULL,
    `stato` ENUM('INVIATA', 'VISTA', 'RISPOSTA', 'SCADUTA') NOT NULL DEFAULT 'INVIATA',
    `risposta` TEXT NULL,
    `risposta_at` DATETIME(3) NULL,
    `applicata_automaticamente` BOOLEAN NOT NULL DEFAULT false,
    `entity_type` VARCHAR(50) NULL,
    `entity_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `richieste_documento_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `richieste_documento_accesso_cliente_id_idx`(`accesso_cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `domande_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `richiesta_documento_id` INTEGER NOT NULL,
    `testo` VARCHAR(500) NOT NULL,
    `opzioni` JSON NOT NULL,
    `risposta_selezionata` VARCHAR(100) NULL,
    `azione_eseguita` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `domande_cliente_richiesta_documento_id_idx`(`richiesta_documento_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `report_cliente` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('IVA_TRIMESTRALE', 'ANDAMENTO', 'PRE_SCADENZA', 'ANNUALE') NOT NULL,
    `periodo` VARCHAR(20) NOT NULL,
    `contenuto_generato` LONGTEXT NOT NULL,
    `contenuto_approvato` LONGTEXT NULL,
    `stato` ENUM('GENERATO', 'APPROVATO', 'INVIATO') NOT NULL DEFAULT 'GENERATO',
    `inviato_via` ENUM('IN_APP', 'EMAIL', 'PORTALE') NULL,
    `inviato_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `report_cliente_societa_id_stato_idx`(`societa_id`, `stato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documenti_condivisi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `accesso_cliente_id` INTEGER NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `tipo` ENUM('BILANCIO', 'CU', 'F24', 'REPORT', 'ALTRO') NOT NULL,
    `file_url` VARCHAR(500) NOT NULL,
    `condiviso_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `documenti_condivisi_societa_id_idx`(`societa_id`),
    INDEX `documenti_condivisi_accesso_cliente_id_idx`(`accesso_cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `notifiche_cliente_destinatario_id_stato_idx` ON `notifiche`(`cliente_destinatario_id`, `stato`);

-- AddForeignKey
ALTER TABLE `notifiche` ADD CONSTRAINT `notifiche_cliente_destinatario_id_fkey` FOREIGN KEY (`cliente_destinatario_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `configurazione_portale` ADD CONSTRAINT `configurazione_portale_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accessi_cliente` ADD CONSTRAINT `accessi_cliente_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `richieste_documento` ADD CONSTRAINT `richieste_documento_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `richieste_documento` ADD CONSTRAINT `richieste_documento_accesso_cliente_id_fkey` FOREIGN KEY (`accesso_cliente_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `domande_cliente` ADD CONSTRAINT `domande_cliente_richiesta_documento_id_fkey` FOREIGN KEY (`richiesta_documento_id`) REFERENCES `richieste_documento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `report_cliente` ADD CONSTRAINT `report_cliente_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documenti_condivisi` ADD CONSTRAINT `documenti_condivisi_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documenti_condivisi` ADD CONSTRAINT `documenti_condivisi_accesso_cliente_id_fkey` FOREIGN KEY (`accesso_cliente_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
