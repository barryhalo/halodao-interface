import React, { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'react-feather'
import { Text } from 'rebass'
import { ButtonEmpty, ButtonPrimaryNormal, ButtonSecondary } from '../Button'
import { AutoColumn } from '../Column'
import Row, { RowFixed, AutoRow, RowBetween } from '../Row'
import { FixedHeightRow, StyledPositionCard } from '.'
import { CustomLightSpinner, ExternalLink } from 'theme'
import NumericalInput from 'components/NumericalInput'
import { CardSection, DataCard } from 'components/earn/styled'
import styled from 'styled-components'
import { transparentize } from 'polished'
import HALO_REWARDS_ABI from '../../constants/haloAbis/Rewards.json'
import { useContract, useTokenContract } from 'hooks/useContract'
import { formatEther, parseEther } from 'ethers/lib/utils'
import Confetti from 'components/Confetti'
import Circle from '../../assets/images/blue-loader.svg'
import { HALO_REWARDS_MESSAGE } from '../../constants/index'

const HALO_REWARDS_ADDRESS = process.env.REACT_APP_HALO_REWARDS_ADDRESS

const BalanceCard = styled(DataCard)`
  background: ${({ theme }) => transparentize(0.5, theme.bg1)};
  border: 1px solid ${({ theme }) => theme.text4};
  overflow: hidden;
  text-align: center;
  margin-top: 10px;
`

export interface BalancerPoolInfo {
  pair: string
  address: string
  balancerUrl: string
  tokenAddress: string
}

interface BalancerPoolCardProps {
  account: string | null | undefined
  poolInfo: BalancerPoolInfo
}

export default function BalancerPoolCard({ account, poolInfo }: BalancerPoolCardProps) {
  const [showMore, setShowMore] = useState(false)
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [allowance, setAllowance] = useState(0)
  const [bptStaked, setBptStaked] = useState(0)
  const [unclaimedHalo, setUnclaimedHalo] = useState(0)
  const [bptBalance, setBptBalance] = useState(0)
  const [loading, setLoading] = useState({
    staking: false,
    unstaking: false,
    claim: false,
    unstakeAndClaim: false,
    confetti: false
  })

  const rewardsContract = useContract(HALO_REWARDS_ADDRESS, HALO_REWARDS_ABI)
  const lpTokenContract = useTokenContract(poolInfo.tokenAddress)
  const backgroundColor = '#FFFFFF'

  // get bpt balance based on the token address in the poolInfo
  const getBptBalance = useCallback(async () => {
    const bptBalanceValue = lpTokenContract?.balanceOf(account)
    setBptBalance(+formatEther(await bptBalanceValue))
  }, [lpTokenContract, account])

  // checks the allowance and skips approval if already within the approved value
  const getAllowance = useCallback(async () => {
    const currentAllowance = await lpTokenContract!.allowance(account, HALO_REWARDS_ADDRESS)
    console.log(+formatEther(currentAllowance))
    setAllowance(+formatEther(currentAllowance))
  }, [lpTokenContract, account])

  const getUserTotalTokenslByPoolAddress = useCallback(async () => {
    const lpTokens = await rewardsContract?.getDepositedPoolTokenBalanceByUser(poolInfo.address, account)

    setBptStaked(+formatEther(lpTokens))
  }, [rewardsContract, account, poolInfo.address])

  const getUnclaimedPoolReward = useCallback(async () => {
    const unclaimedHaloInPool = await rewardsContract?.getUnclaimedPoolRewardsByUserByPool(poolInfo.address, account)

    setUnclaimedHalo(+formatEther(unclaimedHaloInPool))
  }, [rewardsContract, account, poolInfo.address])

  useEffect(() => {
    getUserTotalTokenslByPoolAddress()
    getAllowance()
    getUnclaimedPoolReward()
    getBptBalance()

    // make sure the confetti still activates without refereshing
    setTimeout(() => setLoading({ ...loading, confetti: false }), 3000)
  }, [bptBalance, getAllowance, getUnclaimedPoolReward, getUserTotalTokenslByPoolAddress, getBptBalance])

  const stakeLpToken = async () => {
    setLoading({ ...loading, staking: true })
    const lpTokenAmount = parseEther(stakeAmount)
    getAllowance()
    try {
      if (allowance < +stakeAmount) {
        const approvalTxn = await lpTokenContract!.approve(HALO_REWARDS_ADDRESS, lpTokenAmount.toString())
        await approvalTxn.wait()
      }

      const stakeLpTxn = await rewardsContract?.depositPoolTokens(poolInfo.address, lpTokenAmount.toString())
      await stakeLpTxn.wait()
      setLoading({ ...loading, staking: false, confetti: true })
    } catch (e) {
      console.error(e)
      setLoading({ ...loading, staking: false })
    }

    setStakeAmount('')
    getBptBalance()
  }

  const unstakeLpToken = async () => {
    setLoading({ ...loading, unstaking: true })
    const lpTokenAmount = parseEther(unstakeAmount)
    try {
      const unstakeLpTxn = await rewardsContract!.withdrawPoolTokens(poolInfo.address, lpTokenAmount.toString())
      await unstakeLpTxn.wait()
    } catch (e) {
      console.error(e)
    }

    setUnstakeAmount('')
    setLoading({ ...loading, unstaking: false })
    getBptBalance()
  }

  const claimPoolRewards = async () => {
    setLoading({ ...loading, claim: true })
    try {
      const claimPoolRewardsTxn = await rewardsContract!.withdrawUnclaimedPoolRewards(poolInfo.address)
      await claimPoolRewardsTxn.wait()
      setLoading({ ...loading, claim: false, confetti: true })
    } catch (e) {
      console.error(e)
      setLoading({ ...loading, claim: false })
    }
  }

  const claimAndUnstakeRewards = async () => {
    setLoading({ ...loading, unstakeAndClaim: true })
    try {
      const unstakeLpTxn = await rewardsContract!.withdrawPoolTokens(poolInfo.address, parseEther(bptStaked.toString()))
      await unstakeLpTxn.wait()

      const claimPoolRewardsTxn = await rewardsContract!.withdrawUnclaimedPoolRewards(poolInfo.address)
      await claimPoolRewardsTxn.wait()
      setLoading({ ...loading, unstakeAndClaim: false, confetti: true })
    } catch (e) {
      console.error(e)
      setLoading({ ...loading, unstakeAndClaim: false })
    }
  }

  return (
    <StyledPositionCard bgColor={backgroundColor}>
      <AutoColumn gap="12px">
        <FixedHeightRow>
          <AutoRow gap="8px">
            <Text fontWeight={500} fontSize={20}>
              {poolInfo.pair}
            </Text>
          </AutoRow>
          {account && (
            <RowFixed gap="8px">
              <ButtonEmpty
                padding="6px 8px"
                borderRadius="20px"
                width="fit-content"
                onClick={() => setShowMore(!showMore)}
              >
                {showMore ? (
                  <>
                    Manage
                    <ChevronUp size="20" style={{ marginLeft: '10px' }} />
                  </>
                ) : (
                  <>
                    Manage
                    <ChevronDown size="20" style={{ marginLeft: '10px' }} />
                  </>
                )}
              </ButtonEmpty>
            </RowFixed>
          )}
        </FixedHeightRow>

        {showMore && (
          <AutoColumn gap="8px">
            <ButtonSecondary padding="8px" borderRadius="8px">
              <ExternalLink style={{ width: '100%', textAlign: 'center' }} href={poolInfo.balancerUrl}>
                To stake, get BPT tokens here <span style={{ fontSize: '11px' }}>↗</span>
              </ExternalLink>
            </ButtonSecondary>

            <FixedHeightRow>
              <Confetti start={loading.confetti} />
              <Text fontSize={16} fontWeight={500}>
                Balance: {bptBalance.toFixed(2)} BPT
              </Text>
              <Text fontSize={16} fontWeight={500}>
                Staked: {bptStaked.toFixed(2)} BPT
              </Text>
            </FixedHeightRow>

            <RowBetween marginTop="10px">
              <NumericalInput value={stakeAmount} onUserInput={amount => setStakeAmount(amount)} />
              <NumericalInput value={unstakeAmount} onUserInput={amount => setUnstakeAmount(amount)} />
            </RowBetween>

            <RowBetween marginTop="10px">
              <ButtonPrimaryNormal
                padding="8px"
                borderRadius="8px"
                width="48%"
                disabled={!(parseFloat(stakeAmount) > 0 && parseFloat(stakeAmount) <= bptBalance) || loading.staking}
                onClick={stakeLpToken}
              >
                {loading.staking ? (
                  <>
                    {`${HALO_REWARDS_MESSAGE.staking}`}&nbsp;
                    <CustomLightSpinner src={Circle} alt="loader" size={'15px'} />{' '}
                  </>
                ) : (
                  'Stake'
                )}
              </ButtonPrimaryNormal>
              <ButtonPrimaryNormal
                padding="8px"
                borderRadius="8px"
                width="48%"
                disabled={
                  !(parseFloat(unstakeAmount) > 0 && parseFloat(unstakeAmount) <= bptStaked) || loading.unstaking
                }
                onClick={unstakeLpToken}
              >
                {loading.unstaking ? (
                  <>
                    {`${HALO_REWARDS_MESSAGE.unstaking}`}&nbsp;
                    <CustomLightSpinner src={Circle} alt="loader" size={'15px'} />{' '}
                  </>
                ) : (
                  'Unstake'
                )}
              </ButtonPrimaryNormal>
            </RowBetween>

            <Row justify="center">
              <BalanceCard>
                <CardSection>
                  <Text fontSize={16} fontWeight={500}>
                    Rewards earned: {unclaimedHalo} HALO
                  </Text>
                </CardSection>
              </BalanceCard>
            </Row>

            <RowBetween marginTop="10px">
              <ButtonPrimaryNormal
                padding="8px"
                borderRadius="8px"
                width="48%"
                disabled={!(unclaimedHalo > 0) || loading.claim}
                onClick={claimPoolRewards}
              >
                {loading.claim ? (
                  <>
                    {`${HALO_REWARDS_MESSAGE.claiming}`}&nbsp;
                    <CustomLightSpinner src={Circle} alt="loader" size={'15px'} />{' '}
                  </>
                ) : (
                  'Claim Rewards'
                )}
              </ButtonPrimaryNormal>
              <ButtonPrimaryNormal
                padding="8px"
                borderRadius="8px"
                width="48%"
                disabled={!(unclaimedHalo > 0 && bptStaked > 0) || loading.unstakeAndClaim}
                onClick={claimAndUnstakeRewards}
              >
                {loading.unstakeAndClaim ? (
                  <>
                    {`${HALO_REWARDS_MESSAGE.unstakeAndClaim}`}&nbsp;
                    <CustomLightSpinner src={Circle} alt="loader" size={'15px'} />{' '}
                  </>
                ) : (
                  'Unstake and claim rewards'
                )}
              </ButtonPrimaryNormal>
            </RowBetween>
          </AutoColumn>
        )}
      </AutoColumn>
    </StyledPositionCard>
  )
}
