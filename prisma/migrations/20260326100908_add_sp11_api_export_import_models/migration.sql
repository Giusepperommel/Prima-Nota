-- CreateTable
CREATE TABLE `api_keys` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `nome` VARCHAR(100) NOT NULL,
    `key_hash` VARCHAR(255) NOT NULL,
    `key_prefix` VARCHAR(10) NOT NULL,
    `scopes` JSON NOT NULL,
    `rate_limit_per_hour` INTEGER NOT NULL DEFAULT 1000,
    `rate_limit_per_endpoint` JSON NULL,
    `attiva` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_utilizzo` DATETIME(3) NULL,
    `last_rotated_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_endpoints` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `eventi` JSON NOT NULL,
    `secret` VARCHAR(255) NOT NULL,
    `secret_precedente` VARCHAR(255) NULL,
    `secret_precedente_valido_fino_a` DATETIME(3) NULL,
    `attivo` BOOLEAN NOT NULL DEFAULT true,
    `ultima_consegna` DATETIME(3) NULL,
    `consecutivi_falliti` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_deliveries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `webhook_endpoint_id` INTEGER NOT NULL,
    `evento` VARCHAR(100) NOT NULL,
    `payload` JSON NOT NULL,
    `stato_http` INTEGER NULL,
    `risposta` TEXT NULL,
    `tentativo` INTEGER NOT NULL DEFAULT 1,
    `prossimo_tentativo_at` DATETIME(3) NULL,
    `stato` ENUM('PENDING', 'CONSEGNATO', 'FALLITO') NOT NULL DEFAULT 'PENDING',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `import_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `utente_id` INTEGER NOT NULL,
    `software_origine` VARCHAR(50) NOT NULL,
    `stato` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `file_originale` TEXT NULL,
    `mapping_campi` JSON NULL,
    `righe_processate` INTEGER NOT NULL DEFAULT 0,
    `righe_errore` INTEGER NOT NULL DEFAULT 0,
    `errori` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completato_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `export_jobs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `societa_id` INTEGER NOT NULL,
    `utente_id` INTEGER NOT NULL,
    `tipo` VARCHAR(50) NOT NULL,
    `formato` VARCHAR(10) NOT NULL,
    `filtri` JSON NULL,
    `stato` ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `file_url` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_endpoints` ADD CONSTRAINT `webhook_endpoints_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `webhook_deliveries` ADD CONSTRAINT `webhook_deliveries_webhook_endpoint_id_fkey` FOREIGN KEY (`webhook_endpoint_id`) REFERENCES `webhook_endpoints`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `import_jobs` ADD CONSTRAINT `import_jobs_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `export_jobs` ADD CONSTRAINT `export_jobs_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `export_jobs` ADD CONSTRAINT `export_jobs_utente_id_fkey` FOREIGN KEY (`utente_id`) REFERENCES `utenti`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
