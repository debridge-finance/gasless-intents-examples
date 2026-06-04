export const ALLOWLIST_GUARD_ABI = [
  {
    "type": "constructor",
    "inputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "ALLOWLIST_AUTHORIZATION_TYPEHASH",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "DOMAIN_SEPARATOR",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "NAME",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "VERSION",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "string",
        "internalType": "string"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "allowed",
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
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
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
      },
      {
        "name": "nonce",
        "type": "bytes32",
        "internalType": "bytes32"
      },
      {
        "name": "deadline",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "signature",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "onPostCallForCrossChainIntent",
    "inputs": [
      {
        "name": "ctx",
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
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onPostCallForCrossChainIntentWithPreSwap",
    "inputs": [
      {
        "name": "ctx",
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
    "stateMutability": "nonpayable"
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
        "name": "hookPayload",
        "type": "bytes",
        "internalType": "bytes"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "owner",
    "inputs": [],
    "outputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "setAllowed",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "isAllowed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setManyAllowed",
    "inputs": [
      {
        "name": "subjects",
        "type": "address[]",
        "internalType": "address[]"
      },
      {
        "name": "isAllowed",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "transferOwnership",
    "inputs": [
      {
        "name": "newOwner",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "usedNonces",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      },
      {
        "name": "",
        "type": "bytes32",
        "internalType": "bytes32"
      }
    ],
    "outputs": [
      {
        "name": "",
        "type": "bool",
        "internalType": "bool"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "AllowedCallLogged",
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
        "name": "subject",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "nonce",
        "type": "bytes32",
        "indexed": false,
        "internalType": "bytes32"
      },
      {
        "name": "sender",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "AllowedUpdated",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "allowed",
        "type": "bool",
        "indexed": false,
        "internalType": "bool"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "OwnershipTransferred",
    "inputs": [
      {
        "name": "previousOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      },
      {
        "name": "newOwner",
        "type": "address",
        "indexed": true,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PostObserved",
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
        "name": "sender",
        "type": "address",
        "indexed": false,
        "internalType": "address"
      }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "Expired",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSignature",
    "inputs": []
  },
  {
    "type": "error",
    "name": "InvalidSignatureLength",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NonceUsed",
    "inputs": []
  },
  {
    "type": "error",
    "name": "NotAllowed",
    "inputs": [
      {
        "name": "subject",
        "type": "address",
        "internalType": "address"
      }
    ]
  },
  {
    "type": "error",
    "name": "NotOwner",
    "inputs": []
  },
  {
    "type": "error",
    "name": "ZeroAddress",
    "inputs": []
  }
] as const;
