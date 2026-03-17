-- CreateTable
CREATE TABLE `piani_pagamento` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `operazione_id` INTEGER NOT NULL,
    `societa_id` INTEGER NOT NULL,
    `tipo` ENUM('RATEALE', 'CUSTOM') NOT NULL,
    `stato` ENUM('ATTIVO', 'CHIUSO_ANTICIPATAMENTE', 'COMPLETATO') NOT NULL DEFAULT 'ATTIVO',
    `numero_rate` INTEGER NULL,
    `importo_rata` DECIMAL(10, 2) NULL,
    `tan` DECIMAL(5, 2) NULL,
    `anticipo` DECIMAL(10, 2) NULL DEFAULT 0,
    `frequenza_rate` ENUM('MENSILE') NOT NULL DEFAULT 'MENSILE',
    `data_inizio` DATE NOT NULL,
    `data_chiusura` DATE NULL,
    `motivo_chiusura` ENUM('ESTINZIONE_ANTICIPATA', 'PERMUTA', 'RIFINANZIAMENTO') NULL,
    `penale_estinzione` DECIMAL(10, 2) NULL,
    `saldo_residuo` DECIMAL(10, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `piani_pagamento_operazione_id_key`(`operazione_id`),
    INDEX `piani_pagamento_societa_id_idx`(`societa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pagamenti` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `piano_pagamento_id` INTEGER NOT NULL,
    `numero_pagamento` INTEGER NOT NULL,
    `data` DATE NOT NULL,
    `importo` DECIMAL(10, 2) NOT NULL,
    `quota_capitale` DECIMAL(10, 2) NOT NULL,
    `quota_interessi` DECIMAL(10, 2) NOT NULL,
    `stato` ENUM('PREVISTO', 'EFFETTUATO', 'ANNULLATO') NOT NULL DEFAULT 'PREVISTO',
    `data_effettiva_pagamento` DATE NULL,
    `note` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `pagamenti_piano_pagamento_id_data_stato_idx`(`piano_pagamento_id`, `data`, `stato`),
    INDEX `pagamenti_data_stato_idx`(`data`, `stato`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `piani_pagamento` ADD CONSTRAINT `piani_pagamento_operazione_id_fkey` FOREIGN KEY (`operazione_id`) REFERENCES `operazioni`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `piani_pagamento` ADD CONSTRAINT `piani_pagamento_societa_id_fkey` FOREIGN KEY (`societa_id`) REFERENCES `societa`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pagamenti` ADD CONSTRAINT `pagamenti_piano_pagamento_id_fkey` FOREIGN KEY (`piano_pagamento_id`) REFERENCES `piani_pagamento`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
