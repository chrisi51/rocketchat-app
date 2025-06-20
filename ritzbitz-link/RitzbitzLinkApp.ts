import {
    IAppAccessors,
    IConfigurationExtend,
    IHttp,
    ILogger,
    IModify,
    IPersistence,
    IRead,
} from '@rocket.chat/apps-engine/definition/accessors';
import { App } from '@rocket.chat/apps-engine/definition/App';
import { IAppInfo } from '@rocket.chat/apps-engine/definition/metadata';
import { IMessage, IPostMessageSent, IPostMessageUpdated } from '@rocket.chat/apps-engine/definition/messages';

export class RitzbitzLinkApp extends App implements IPostMessageSent, IPostMessageUpdated {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    private async patchMessage(message: IMessage, read: IRead, modify: IModify): Promise<void> {
        this.getLogger().debug('Processing message', message);
        const originalHtml: string = (message as any).html || '';
        const patchedHtml = originalHtml.replace(/(ritzbitz:\/\/[^\s<>"]+)/gi, '<a href="$1" target="_blank">$1</a>');

        if (patchedHtml === originalHtml || !message.id) {
            this.getLogger().debug('Abbruch', originalHtml, '==', patchedHtml);
            return;
        }

        this.getLogger().debug('Update', originalHtml, 'zu', patchedHtml);


        const appUser = await read.getUserReader().getAppUser();
        if (!appUser) {
            return;
        }

        const builder = await modify.getUpdater().message(message.id, appUser);
        builder.setUpdateData({ ...(builder.getMessage() as any), html: patchedHtml }, appUser);
        await modify.getUpdater().finish(builder);

        this.getLogger().debug('new Message', builder.getMessage());

    }

    public async executePostMessageSent(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify,
    ): Promise<void> {
        this.getLogger().debug('executePostMessageSent called');
        await this.patchMessage(message, read, modify);
    }

    public async executePostMessageUpdated(
        message: IMessage,
        read: IRead,
        http: IHttp,
        persistence: IPersistence,
        modify: IModify,
    ): Promise<void> {
        this.getLogger().debug('executePostMessageUpdated called');
        await this.patchMessage(message, read, modify);
    }

    public async extendConfiguration(configuration: IConfigurationExtend): Promise<void> {
        // no configuration
    }
}
