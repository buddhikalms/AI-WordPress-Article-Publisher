CREATE TABLE `AiProviderCredential` (
  `id` VARCHAR(191) NOT NULL,
  `ownerType` VARCHAR(191) NOT NULL,
  `ownerId` VARCHAR(191) NOT NULL,
  `provider` VARCHAR(191) NOT NULL,
  `apiKeyEncrypted` TEXT NOT NULL,
  `defaultModel` VARCHAR(191) NULL,
  `isEnabled` BOOLEAN NOT NULL DEFAULT true,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `AiProviderCredential_ownerType_ownerId_provider_key`(`ownerType`, `ownerId`, `provider`),
  INDEX `AiProviderCredential_ownerType_ownerId_idx`(`ownerType`, `ownerId`),
  INDEX `AiProviderCredential_provider_idx`(`provider`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;