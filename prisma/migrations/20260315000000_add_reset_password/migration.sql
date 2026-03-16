-- CreateTable
CREATE TABLE `reset_password` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `codice` VARCHAR(5) NOT NULL,
    `scadenza` DATETIME(3) NOT NULL,
    `utilizzato` BOOLEAN NOT NULL DEFAULT false,
    `tentativi` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reset_password_email_utilizzato_scadenza_idx`(`email`, `utilizzato`, `scadenza`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
