enum ContractStatus {
  pending,
  confirmed,
  cancelled,
}

class SettlementModel {
  final String txSignature;
  final String payerWallet;
  final String recipientWallet;
  final double amount;
  final String mint;
  final int slot;
  final int blockTime;
  final DateTime verifiedAt;
  final String explorerUrl;

  const SettlementModel({
    required this.txSignature,
    required this.payerWallet,
    required this.recipientWallet,
    required this.amount,
    required this.mint,
    required this.slot,
    required this.blockTime,
    required this.verifiedAt,
    required this.explorerUrl,
  });

  factory SettlementModel.fromJson(Map<String, dynamic> json) {
    return SettlementModel(
      txSignature: (json['txSignature'] as String?) ?? '',
      payerWallet: (json['payerWallet'] as String?) ?? '',
      recipientWallet: (json['recipientWallet'] as String?) ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      mint: (json['mint'] as String?) ?? '',
      slot: (json['slot'] as num?)?.toInt() ?? 0,
      blockTime: (json['blockTime'] as num?)?.toInt() ?? 0,
      verifiedAt: DateTime.tryParse((json['verifiedAt'] as String?) ?? '') ??
          DateTime.now(),
      explorerUrl: (json['explorerUrl'] as String?) ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'txSignature': txSignature,
      'payerWallet': payerWallet,
      'recipientWallet': recipientWallet,
      'amount': amount,
      'mint': mint,
      'slot': slot,
      'blockTime': blockTime,
      'verifiedAt': verifiedAt.toIso8601String(),
      'explorerUrl': explorerUrl,
    };
  }
}

class ContractModel {
  final String contractId;
  final String projectTitle;
  final String scopeDescription;
  final String clientName;
  final double amount;
  final String tokenSymbol;
  final String tokenMint;
  final String freelancerWallet;
  final ContractStatus status;
  final String contractHash;
  final String referencePublicKey;
  final DateTime createdAt;
  final SettlementModel? settlement;

  const ContractModel({
    required this.contractId,
    required this.projectTitle,
    required this.scopeDescription,
    required this.clientName,
    required this.amount,
    this.tokenSymbol = 'DUSD',
    required this.tokenMint,
    required this.freelancerWallet,
    required this.status,
    required this.contractHash,
    required this.referencePublicKey,
    required this.createdAt,
    this.settlement,
  });

  bool get isPaid => status == ContractStatus.confirmed;

  factory ContractModel.fromJson(Map<String, dynamic> json) {
    return ContractModel(
      contractId: (json['contractId'] as String?) ?? '',
      projectTitle: (json['projectTitle'] as String?) ?? '',
      scopeDescription: (json['scopeDescription'] as String?) ?? '',
      clientName: (json['clientName'] as String?) ?? '',
      amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
      tokenSymbol: (json['tokenSymbol'] as String?) ?? 'DUSD',
      tokenMint: (json['tokenMint'] as String?) ?? '',
      freelancerWallet: (json['freelancerWallet'] as String?) ?? '',
      status: _parseStatus((json['status'] as String?) ?? 'PENDING'),
      contractHash: (json['contractHash'] as String?) ?? '',
      referencePublicKey: (json['referencePublicKey'] as String?) ?? '',
      createdAt: DateTime.tryParse((json['createdAt'] as String?) ?? '') ??
          DateTime.now(),
      settlement: json['settlement'] != null && json['settlement'] is Map<String, dynamic>
          ? SettlementModel.fromJson(json['settlement'] as Map<String, dynamic>)
          : null,
    );
  }

  static ContractStatus _parseStatus(String val) {
    switch (val.toUpperCase()) {
      case 'CONFIRMED':
      case 'PAID':
        return ContractStatus.confirmed;
      case 'CANCELLED':
        return ContractStatus.cancelled;
      default:
        return ContractStatus.pending;
    }
  }

  Map<String, dynamic> toJson() {
    return {
      'contractId': contractId,
      'projectTitle': projectTitle,
      'scopeDescription': scopeDescription,
      'clientName': clientName,
      'amount': amount,
      'tokenSymbol': tokenSymbol,
      'tokenMint': tokenMint,
      'freelancerWallet': freelancerWallet,
      'status': status == ContractStatus.confirmed ? 'CONFIRMED' : 'PENDING',
      'contractHash': contractHash,
      'referencePublicKey': referencePublicKey,
      'createdAt': createdAt.toIso8601String(),
      if (settlement != null) 'settlement': settlement!.toJson(),
    };
  }
}
