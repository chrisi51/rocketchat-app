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
import {
    IMessage,
    IPostMessageSent,
    IPostMessageUpdated,
} from '@rocket.chat/apps-engine/definition/messages';

export class RitzbitzLinkApp extends App implements IPostMessageSent, IPostMessageUpdated {
    constructor(info: IAppInfo, logger: ILogger, accessors: IAppAccessors) {
        super(info, logger, accessors);
    }

    private convertTextToNodes(text: string): Array<any> {
        const regex = /(ritzbitz:\/\/[^\s]+)/gi;
        const nodes = [] as Array<any>;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                nodes.push({ type: 'PLAIN_TEXT', value: text.slice(lastIndex, match.index) });
            }
            const url = match[1];
            nodes.push({
                type: 'LINK',
                value: {
                    src: { type: 'PLAIN_TEXT', value: url },
                    label: [{ type: 'PLAIN_TEXT', value: url }],
                },
            });
            lastIndex = regex.lastIndex;
        }
        if (lastIndex < text.length) {
            nodes.push({ type: 'PLAIN_TEXT', value: text.slice(lastIndex) });
        }

        return nodes;
    }

    private patchMd(md: Array<any>): boolean {
        let changed = false;
        md.forEach((block) => {
            if (block.type === 'PARAGRAPH' && Array.isArray(block.value)) {
                const newValue: Array<any> = [];
                block.value.forEach((child: any) => {
                    if (child.type === 'PLAIN_TEXT') {
                        const converted = this.convertTextToNodes(child.value);
                        if (converted.length !== 1 || converted[0].value !== child.value) {
                            changed = true;
                        }
                        newValue.push(...converted);
                    } else {
                        newValue.push(child);
                    }
                });
                if (changed) {
                    block.value = newValue;
                }
            }
        });
        return changed;
    }

    private async patchMessage(message: IMessage, read: IRead, modify: IModify): Promise<void> {
        this.getLogger().debug('Processing message', message);

        const appUser = await read.getUserReader().getAppUser();
        if (!appUser) {
            return;
        }

        if (message.editor && (message.editor as any).id === appUser.id) {
            this.getLogger().debug('Message was edited by the app, skipping');
            return;
        }

        const md: Array<any> | undefined =
            (message as any).md || (message as any)._unmappedProperties_?.md;

        if (!md) {
            this.getLogger().debug('No md field found');
            return;
        }

        const mdCopy = JSON.parse(JSON.stringify(md));
        const changed = this.patchMd(mdCopy);
        if (!changed || !message.id) {
            this.getLogger().debug('No ritzbitz:// link found, skipping');
            return;
        }

        const builder = await modify.getUpdater().message(message.id, appUser);
        builder.setUpdateData({ ...(builder.getMessage() as any), md: mdCopy }, appUser);
        await modify.getUpdater().finish(builder);

        this.getLogger().debug('patched message', builder.getMessage());
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
