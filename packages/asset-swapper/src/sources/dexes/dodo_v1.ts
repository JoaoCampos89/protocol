import { ChainId } from '@0x/contract-addresses';
import { BigNumber } from '@0x/utils';

import { Address } from '../../types';
import { Chain } from '../../utils/chain';
import { valueByChainId } from '../../utils/utils';
import { ERC20BridgeSamplerContract } from '../../wrappers';

import { NULL_ADDRESS } from '../constants';
import { SourceSamplerBase } from '../source_sampler';
import { DexSample, ERC20BridgeSource, FillData } from "../types";

export interface DodoFillData extends FillData {
    poolAddress: string;
    isSellBase: boolean;
    helperAddress: string;
}

interface DodoV1Info {
    helper: Address;
    registry: Address;
}

const DODOV1_CONFIG_BY_CHAIN_ID = valueByChainId(
    {
        [ChainId.Mainnet]: {
            helper: '0x533da777aedce766ceae696bf90f8541a4ba80eb',
            registry: '0x3A97247DF274a17C59A3bd12735ea3FcDFb49950',
        },
        [ChainId.BSC]: {
            helper: '0x0f859706aee7fcf61d5a8939e8cb9dbb6c1eda33',
            registry: '0xca459456a45e300aa7ef447dbb60f87cccb42828',
        },
        [ChainId.Polygon]: {
            helper: '0xdfaf9584f5d229a9dbe5978523317820a8897c5a',
            registry: '0x357c5e9cfa8b834edcef7c7aabd8f9db09119d11',
        },
    },
    { helper: NULL_ADDRESS, registry: NULL_ADDRESS },
) as { [k in ChainId]: DodoV1Info; };

export class DodoV1Sampler extends
    SourceSamplerBase<ERC20BridgeSamplerContract, ERC20BridgeSamplerContract>
{
    public static async createAsync(chain: Chain): Promise<DodoV1Sampler> {
        return new DodoV1Sampler(
            chain,
            DODOV1_CONFIG_BY_CHAIN_ID[chain.chainId],
        );
    }

    protected constructor(chain: Chain, private readonly _dodoInfo: DodoV1Info) {
        super({
            chain,
            sellSamplerContractArtifactName: 'ERC20BridgeSampler',
            buySamplerContractArtifactName: 'ERC20BridgeSampler',
            sellSamplerContractType: ERC20BridgeSamplerContract,
            buySamplerContractType: ERC20BridgeSamplerContract,
        });
    }

    public canConvertTokens(tokenAddressPath: Address[]): boolean {
        return tokenAddressPath.length === 2;
    }

    public async getSellQuotesAsync(
        tokenAddressPath: Address[],
        takerFillAmounts: BigNumber[],
    ): Promise<DexSample<DodoFillData>[][]> {
        if (!this.canConvertTokens(tokenAddressPath)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const [isSellBase, poolAddress, samples] = await this._sellContractHelper.ethCallAsync(
            this._sellContract.sampleSellsFromDODO,
            [
                this._dodoInfo,
                takerToken,
                makerToken,
                takerFillAmounts,
            ],
        );
        return [takerFillAmounts.map((a, i) => ({
                source: ERC20BridgeSource.Dodo,
                fillData: {
                    isSellBase,
                    poolAddress,
                    helperAddress: this._dodoInfo.helper,
                },
                input: a,
                output: samples[i],
        }))];
    }

    public async getBuyQuotesAsync(
        tokenAddressPath: Address[],
        makerFillAmounts: BigNumber[],
    ): Promise<DexSample<DodoFillData>[][]> {
        if (!this.canConvertTokens(tokenAddressPath)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const [isSellBase, poolAddress, samples] = await this._buyContractHelper.ethCallAsync(
            this._buyContract.sampleBuysFromDODO,
            [
                this._dodoInfo,
                takerToken,
                makerToken,
                makerFillAmounts,
            ],
        );
        return [makerFillAmounts.map((a, i) => ({
                source: ERC20BridgeSource.Dodo,
                fillData: {
                    isSellBase,
                    poolAddress,
                    helperAddress: this._dodoInfo.helper,
                },
                input: a,
                output: samples[i],
        }))];
    }
}
