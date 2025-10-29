import {Keypair} from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

function signHexMessageBySolanaKey(
    messageHex: string,
    privateKey: Keypair
) {
    console.log(Buffer.from('0x69a63fd0950816af739a4dbffbd8b867d19888736bdee8e3b78ddd75f2d1bc87', 'hex'))
    console.log(Buffer.from('69a63fd0950816af739a4dbffbd8b867d19888736bdee8e3b78ddd75f2d1bc87', 'hex'))


    console.log(Buffer.from([105, 166, 63, 208, 149, 8, 22, 175, 115, 154, 77, 191, 251, 216, 184, 103, 209, 152, 136, 115, 107, 222, 232, 227, 183, 141, 221, 117, 242, 209, 188, 135]).toString('hex'))
    const sig = nacl.sign.detached(
        Buffer.from([105, 166, 63, 208, 149, 8, 22, 175, 115, 154, 77, 191, 251, 216, 184, 103, 209, 152, 136, 115, 107, 222, 232, 227, 183, 141, 221, 117, 242, 209, 188, 135]),
        Keypair.fromSecretKey(
            bs58.decode(
                'paste_your_key',
            ),
        ).secretKey,
    );
    const finalSignature = Buffer.from(sig).toString('hex')
    console.log('1:', finalSignature)

    const sig2 = nacl.sign.detached(
        Buffer.from('0x69a63fd0950816af739a4dbffbd8b867d19888736bdee8e3b78ddd75f2d1bc87'.slice(2), 'hex'),
        Keypair.fromSecretKey(
            bs58.decode(
                'paste_your_key',
            ),
        ).secretKey,
    );
    const finalSignature2 = Buffer.from(sig).toString('hex')
    console.log('2: ', finalSignature2)
}

signHexMessageBySolanaKey(
    '0xce26e61d623933dac60284dd2c54281258b918eb44f10041dfccabb5f414648c',
    Keypair.fromSecretKey(bs58.decode('paste_your_key')),
)
