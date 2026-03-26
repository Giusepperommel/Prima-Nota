-- CreateTable
CREATE TABLE `thread_portale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `accesso_cliente_id` INTEGER NOT NULL,
    `oggetto` VARCHAR(255) NOT NULL,
    `contesto_tipo` ENUM('DOCUMENTO', 'SCADENZA', 'OPERAZIONE', 'ALERT', 'LIBERO') NULL,
    `contesto_id` INTEGER NULL,
    `stato` ENUM('APERTO', 'CHIUSO') NOT NULL DEFAULT 'APERTO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `ultimo_messaggio_at` DATETIME(3) NULL,

    INDEX `thread_portale_societa_id_accesso_cliente_id_idx`(`societa_id`, `accesso_cliente_id`),
    INDEX `thread_portale_societa_id_stato_idx`(`societa_id`, `stato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messaggi_portale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `thread_id` INTEGER NOT NULL,
    `accesso_cliente_id` INTEGER NOT NULL,
    `mittente_tipo` ENUM('CLIENTE', 'COMMERCIALISTA') NOT NULL,
    `mittente_id` INTEGER NOT NULL,
    `testo` TEXT NOT NULL,
    `letto` BOOLEAN NOT NULL DEFAULT false,
    `letto_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messaggi_portale_thread_id_created_at_idx`(`thread_id`, `created_at`),
    INDEX `messaggi_portale_societa_id_letto_idx`(`societa_id`, `letto`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `allegati_messaggio` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `messaggio_id` INTEGER NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `mime_type` VARCHAR(100) NOT NULL,
    `dimensione` INTEGER NOT NULL,
    `file_url` TEXT NOT NULL,
    `documento_condiviso_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operazioni_portale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `accesso_cliente_id` INTEGER NOT NULL,
    `tipo` ENUM('INCASSO', 'PAGAMENTO', 'FATTURA') NOT NULL,
    `dati` JSON NOT NULL,
    `documento_allegato` TEXT NULL,
    `stato` ENUM('BOZZA', 'VALIDATA', 'RIFIUTATA') NOT NULL DEFAULT 'BOZZA',
    `operazione_id` INTEGER NULL,
    `note_commercialista` TEXT NULL,
    `validata_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operazioni_portale_societa_id_stato_idx`(`societa_id`, `stato`),
    INDEX `operazioni_portale_accesso_cliente_id_idx`(`accesso_cliente_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `permessi_portale` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `accesso_cliente_id` INTEGER NOT NULL,
    `sezione` ENUM('KPI', 'PRIMA_NOTA', 'DOCUMENTI', 'CHAT', 'IVA', 'SCADENZARIO', 'FATTURE', 'F24', 'BILANCIO', 'REPORT') NOT NULL,
    `lettura` BOOLEAN NOT NULL DEFAULT true,
    `scrittura` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `permessi_portale_accesso_cliente_id_sezione_key`(`accesso_cliente_id`, `sezione`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `thread_portale` ADD CONSTRAINT `thread_portale_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `thread_portale` ADD CONSTRAINT `thread_portale_accesso_cliente_id_fkey` FOREIGN KEY (`accesso_cliente_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messaggi_portale` ADD CONSTRAINT `messaggi_portale_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messaggi_portale` ADD CONSTRAINT `messaggi_portale_thread_id_fkey` FOREIGN KEY (`thread_id`) REFERENCES `thread_portale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messaggi_portale` ADD CONSTRAINT `messaggi_portale_accesso_cliente_id_fkey` FOREIGN KEY (`accesso_cliente_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `allegati_messaggio` ADD CONSTRAINT `allegati_messaggio_messaggio_id_fkey` FOREIGN KEY (`messaggio_id`) REFERENCES `messaggi_portale`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `allegati_messaggio` ADD CONSTRAINT `allegati_messaggio_documento_condiviso_id_fkey` FOREIGN KEY (`documento_condiviso_id`) REFERENCES `documenti_condivisi`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni_portale` ADD CONSTRAINT `operazioni_portale_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni_portale` ADD CONSTRAINT `operazioni_portale_accesso_cliente_id_fkey` FOREIGN KEY (`accesso_cliente_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operazioni_portale` ADD CONSTRAINT `operazioni_portale_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `permessi_portale` ADD CONSTRAINT `permessi_portale_accesso_cliente_id_fkey` FOREIGN KEY (`accesso_cliente_id`) REFERENCES `accessi_cliente`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
