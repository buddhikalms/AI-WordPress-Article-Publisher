-- CreateTable
CREATE TABLE `McpOAuthClient` (
    `id` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `clientName` VARCHAR(191) NOT NULL,
    `redirectUris` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `McpOAuthClient_clientId_key`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `McpAuthorizationCode` (
    `id` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `redirectUri` VARCHAR(191) NOT NULL,
    `codeChallenge` VARCHAR(191) NOT NULL,
    `codeChallengeMethod` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `McpAuthorizationCode_codeHash_key`(`codeHash`),
    INDEX `McpAuthorizationCode_clientId_idx`(`clientId`),
    INDEX `McpAuthorizationCode_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `McpAccessToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastUsedAt` DATETIME(3) NULL,
    `revokedAt` DATETIME(3) NULL,

    UNIQUE INDEX `McpAccessToken_tokenHash_key`(`tokenHash`),
    INDEX `McpAccessToken_userId_idx`(`userId`),
    INDEX `McpAccessToken_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `McpRefreshToken` (
    `id` VARCHAR(191) NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `scope` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `McpRefreshToken_tokenHash_key`(`tokenHash`),
    INDEX `McpRefreshToken_userId_idx`(`userId`),
    INDEX `McpRefreshToken_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `McpActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NULL,
    `tool` VARCHAR(191) NOT NULL,
    `requestId` VARCHAR(191) NULL,
    `siteId` VARCHAR(191) NULL,
    `wordpressPostId` INTEGER NULL,
    `action` VARCHAR(191) NOT NULL,
    `success` BOOLEAN NOT NULL,
    `tokensSpent` INTEGER NULL,
    `errorSummary` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `McpActivityLog_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `McpActivityLog_tool_createdAt_idx`(`tool`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `McpAuthorizationCode` ADD CONSTRAINT `McpAuthorizationCode_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `McpOAuthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `McpAuthorizationCode` ADD CONSTRAINT `McpAuthorizationCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `McpAccessToken` ADD CONSTRAINT `McpAccessToken_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `McpOAuthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `McpAccessToken` ADD CONSTRAINT `McpAccessToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `McpRefreshToken` ADD CONSTRAINT `McpRefreshToken_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `McpOAuthClient`(`clientId`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `McpRefreshToken` ADD CONSTRAINT `McpRefreshToken_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `McpActivityLog` ADD CONSTRAINT `McpActivityLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
