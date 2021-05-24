import { ChainId } from '@0x/contract-addresses';
import { BigNumber } from '@0x/utils';

import { Address } from '../../types';
import { Chain } from '../../utils/chain';
import { valueByChainId } from '../../utils/utils';
import { ERC20BridgeSamplerContract } from '../../wrappers';

import { SourceSamplerBase } from '../source_sampler';
import { DexSample, ERC20BridgeSource, FillData } from "../types";

export interface DodoV2FillData extends FillData {
    poolAddress: string;
    isSellBase: boolean;
}

const DODOV2_FACTORIES_BY_CHAIN_ID = valueByChainId<string[]>(
    {
        [ChainId.Mainnet]: [
            '0x6b4fa0bc61eddc928e0df9c7f01e407bfcd3e5ef', // Private Pool
            '0x72d220ce168c4f361dd4dee5d826a01ad8598f6c', // Vending Machine
            '0x6fddb76c93299d985f4d3fc7ac468f9a168577a4', // Stability Pool
        ],
        [ChainId.BSC]: [
            '0xafe0a75dffb395eaabd0a7e1bbbd0b11f8609eef', // Private Pool
            '0x790b4a80fb1094589a3c0efc8740aa9b0c1733fb', // Vending Machine
            '0x0fb9815938ad069bf90e14fe6c596c514bede767', // Stability Pool
        ],
        [ChainId.Polygon]: [
            '0x95e887adf9eaa22cc1c6e3cb7f07adc95b4b25a8', // Private Pool
            '0x79887f65f83bdf15bcc8736b5e5bcdb48fb8fe13', // Vending Machine
            '0x43c49f8dd240e1545f147211ec9f917376ac1e87', // Stability Pool
        ],
    },
    [] as string[],
) as { [k in ChainId]: Address[] };

const MAX_DODOV2_POOLS_QUERIED = 3;
const DODO_V2_OFFSETS = [...new Array(MAX_DODOV2_POOLS_QUERIED)].map((_v, i) => new BigNumber(i))

export class DodoV2Sampler extends
    SourceSamplerBase<ERC20BridgeSamplerContract, ERC20BridgeSamplerContract>
{
    public static async createAsync(chain: Chain): Promise<DodoV2Sampler> {
        return new DodoV2Sampler(
            chain,
            DODOV2_FACTORIES_BY_CHAIN_ID[chain.chainId],
        );
    }

    protected constructor(chain: Chain, private readonly _factories: Address[]) {
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
    ): Promise<DexSample<DodoV2FillData>[][]> {
        if (!this.canConvertTokens(tokenAddressPath)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const results = (await Promise.all(this._factories.map(async factory =>
            Promise.all(DODO_V2_OFFSETS.map(async offset =>
                this._sellContractHelper.ethCallAsync(
                    this._sellContract.sampleSellsFromDODOV2,
                    [
                        factory,
                        offset,
                        takerToken,
                        makerToken,
                        takerFillAmounts,
                    ]
                ),
            )),
        ))).flat(1);
        return results.map(([isSellBase, poolAddress, samples]) =>
            takerFillAmounts.map((a, i) => ({
                source: ERC20BridgeSource.DodoV2,
                fillData: { poolAddress, isSellBase },
                input: a,
                output: samples[i],
            }))
        );
    }

    public async getBuyQuotesAsync(
        tokenAddressPath: Address[],
        makerFillAmounts: BigNumber[],
    ): Promise<DexSample<DodoV2FillData>[][]> {
        if (!this.canConvertTokens(tokenAddressPath)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const results = (await Promise.all(this._factories.map(async factory =>
            Promise.all(DODO_V2_OFFSETS.map(async offset =>
                this._buyContractHelper.ethCallAsync(
                    this._buyContract.sampleBuysFromDODOV2,
                    [
                        factory,
                        offset,
                        takerToken,
                        makerToken,
                        makerFillAmounts,
                    ]
                ),
            )),
        ))).flat(1);
        return results.map(([isSellBase, poolAddress, samples]) =>
            makerFillAmounts.map((a, i) => ({
                source: ERC20BridgeSource.DodoV2,
                fillData: { poolAddress, isSellBase },
                input: a,
                output: samples[i],
            }))
        );
    }
}
