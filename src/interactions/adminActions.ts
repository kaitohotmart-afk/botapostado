import { VercelRequest, VercelResponse } from '@vercel/node';
    } catch (error) {
    console.error('Error closing channel:', error);
    return res.status(200).json({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: { content: '❌ Erro ao fechar o canal.', flags: 64 }
    });
}
}
