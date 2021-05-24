import { ChainId } from '@0x/contract-addresses';
import { BigNumber } from '@0x/utils';

import { Address } from '../../types';
import { Chain } from '../../utils/chain';
import { valueByChainId } from '../../utils/utils';
import { ERC20BridgeSamplerContract } from '../../wrappers';

import { NULL_ADDRESS } from '../constants';
import { SourceSamplerBase } from '../source_sampler';
import { WRAPPED_NETWORK_TOKEN_BY_CHAIN_ID } from '../tokens';
import { DexSample, ERC20BridgeSource, FillData } from "../types";

export interface MooniswapFillData extends FillData {
    poolAddress: string;
}

type MooniswapRegistriesByChainId = {
    [k in ChainId]: Address[]
};

const MOONISWAP_REGISTRIES_BY_CHAIN_ID = valueByChainId(
    {
        [ChainId.Mainnet]: [
            '0x71CD6666064C3A1354a3B4dca5fA1E2D3ee7D303',
            '0xc4a8b7e29e3c8ec560cd4945c1cf3461a85a148d',
            '0xbaf9a5d4b0052359326a6cdab54babaa3a3a9643',
        ],
        [ChainId.BSC]: ['0xd41b24bba51fac0e4827b6f94c0d6ddeb183cd64'],
    },
    [] as Address[],
) as MooniswapRegistriesByChainId;

export class MooniswapSampler extends
    SourceSamplerBase<ERC20BridgeSamplerContract, ERC20BridgeSamplerContract>
{
    public static async createAsync(chain: Chain): Promise<MooniswapSampler> {
        return new MooniswapSampler(
            chain,
            MOONISWAP_REGISTRIES_BY_CHAIN_ID[chain.chainId],
            WRAPPED_NETWORK_TOKEN_BY_CHAIN_ID[chain.chainId],
        );
    }

    protected constructor(chain: Chain, private readonly _registries: Address[], private readonly _weth: Address) {
        super({
            chain,
            sellSamplerContractArtifactName: 'ERC20BridgeSampler',
            buySamplerContractArtifactName: 'ERC20BridgeSampler',
            sellSamplerContractType: ERC20BridgeSamplerContract,
            buySamplerContractType: ERC20BridgeSamplerContract,
        });
    }

    public canConvertTokens(tokenAddressPath: Address[]): boolean {
        return tokenAddressPath.length === 2 && this._registries.length > 0;
    }

    public async getSellQuotesAsync(
        tokenAddressPath: Address[],
        takerFillAmounts: BigNumber[],
    ): Promise<DexSample<MooniswapFillData>[][]> {
        if (!this.canConvertTokens(tokenAddressPath)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const resultsPerRegistry = await Promise.all(this._registries.map(async registry =>
            this._sellContractHelper.ethCallAsync(
                this._sellContract.sampleSellsFromMooniswap,
                [
                    registry,
                    this._normalizeToken(takerToken),
                    this._normalizeToken(makerToken),
                    takerFillAmounts,
                ],
            ),
        ));
        return resultsPerRegistry.map(([poolAddress, samples]) =>
            takerFillAmounts.map((a, j) => ({
                source: ERC20BridgeSource.Mooniswap,
                fillData: { poolAddress },
                input: a,
                output: samples[j],
            })),
        );
    }

    public async getBuyQuotesAsync(
        tokenAddressPath: Address[],
        makerFillAmounts: BigNumber[],
    ): Promise<DexSample<MooniswapFillData>[][]> {
        if (!this.canConvertTokens(tokenAddressPath)) {
            return [];
        }
        const [takerToken, makerToken] = tokenAddressPath;
        const resultsPerRegistry = await Promise.all(this._registries.map(async registry =>
            this._buyContractHelper.ethCallAsync(
                this._buyContract.sampleBuysFromMooniswap,
                [
                    registry,
                    this._normalizeToken(takerToken),
                    this._normalizeToken(makerToken),
                    makerFillAmounts,
                ],
            ),
        ));
        return resultsPerRegistry.map(([poolAddress, samples]) =>
            makerFillAmounts.map((a, j) => ({
                source: ERC20BridgeSource.Mooniswap,
                fillData: { poolAddress },
                input: a,
                output: samples[j],
            })),
        );
    }

    private _normalizeToken(token: Address): Address {
        // Uniswap V1 only deals in ETH, not WETH, and we treat null as ETH in
        // the sampler.
        if (token.toLowerCase() === this._weth.toLowerCase()) {
            return NULL_ADDRESS;
        }
        return token;
    }
}
