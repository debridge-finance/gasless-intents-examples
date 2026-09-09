export const PROTOCOL_FEE_RECORDER_ABI = [
  {
    "type": "function",
    "name": "decodePayload",
    "inputs": [
      {
        "name": "hookPayload",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "intentTokenFee",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onPostCallForCrossChainIntent",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IPostInteractionHook.CrossChainContext",
        "components": [
          {
            "name": "intentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "tradeId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "payload",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "giveToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "giveAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeToken",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "takeAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeChainId",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "takeChainReceiver",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "onPostCallForCrossChainIntentWithPreSwap",
    "inputs": [
      {
        "name": "",
        "type": "tuple",
        "internalType": "struct IPostInteractionHook.CrossChainWithPreSwapContext",
        "components": [
          {
            "name": "intentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "tradeId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "payload",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "preSwapResults",
            "type": "tuple[]",
            "internalType": "struct IPreSwapResult.PreSwapResult[]",
            "components": [
              {
                "name": "inputToken",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "inputAmount",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "outputAmount",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "giveToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "giveAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeToken",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "takeAmount",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "takeChainId",
            "type": "uint32",
            "internalType": "uint32"
          },
          {
            "name": "takeChainReceiver",
            "type": "bytes",
            "internalType": "bytes"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "onPostCallForSameChainIntentWithPreSwap",
    "inputs": [
      {
        "name": "ctx",
        "type": "tuple",
        "internalType": "struct IPostInteractionHook.SameChainWithPreSwapChainContext",
        "components": [
          {
            "name": "intentId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "tradeId",
            "type": "bytes32",
            "internalType": "bytes32"
          },
          {
            "name": "payload",
            "type": "bytes",
            "internalType": "bytes"
          },
          {
            "name": "preSwapResults",
            "type": "tuple[]",
            "internalType": "struct IPreSwapResult.PreSwapResult[]",
            "components": [
              {
                "name": "inputToken",
                "type": "address",
                "internalType": "address"
              },
              {
                "name": "inputAmount",
                "type": "uint256",
                "internalType": "uint256"
              },
              {
                "name": "outputAmount",
                "type": "uint256",
                "internalType": "uint256"
              }
            ]
          },
          {
            "name": "takeToken",
            "type": "address",
            "internalType": "address"
          },
          {
            "name": "takeAmountAfterFeeCharge",
            "type": "uint256",
            "internalType": "uint256"
          },
          {
            "name": "receiver",
            "type": "address",
            "internalType": "address"
          }
        ]
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onPreCall",
    "inputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "tokenTotalFee",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "ProtocolFeeRecorded",
    "inputs": [
      {
        "name": "intentId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "tradeId",
        "type": "bytes32",
        "indexed": true,
        "internalType": "bytes32"
      },
      {
        "name": "takeToken",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "subject",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      },
      {
        "name": "totalPreSwapOutput",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "takeAmountAfterFeeCharge",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "feeAmount",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      },
      {
        "name": "feeBps",
        "type": "uint256",
        "indexed": false,
        "internalType": "uint256"
      }
    ],
    "anonymous": false
  }
] as const;
