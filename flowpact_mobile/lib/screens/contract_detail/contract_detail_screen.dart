import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme/app_colors.dart';
import '../../core/constants/api_config.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/contract_model.dart';
import '../../providers/contract_provider.dart';

class ContractDetailScreen extends StatefulWidget {
  final ContractModel contract;

  const ContractDetailScreen({
    super.key,
    required this.contract,
  });

  @override
  State<ContractDetailScreen> createState() => _ContractDetailScreenState();
}

class _ContractDetailScreenState extends State<ContractDetailScreen> {
  late ContractModel _currentContract;
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    _currentContract = widget.contract;
  }

  Future<void> _refreshContract() async {
    setState(() {
      _isRefreshing = true;
    });
    try {
      final updated = await context
          .read<ContractProvider>()
          .fetchContractById(_currentContract.contractId);
      if (updated != null && mounted) {
        setState(() {
          _currentContract = updated;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshing = false;
        });
      }
    }
  }

  Future<void> _launchExternalUrl(String url) async {
    final uri = Uri.parse(url);
    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.errorRed,
            content: Text('Could not launch external browser for $url'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: AppColors.errorRed,
            content: Text('Error opening link: $e'),
          ),
        );
      }
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        backgroundColor: AppColors.surface,
        duration: const Duration(seconds: 2),
        content: Row(
          children: [
            const Icon(Icons.check_circle_rounded,
                color: AppColors.solanaGreen, size: 18),
            const SizedBox(width: 8),
            Text('$label copied to clipboard',
                style: const TextStyle(color: AppColors.textPrimary)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isPaid = _currentContract.isPaid;
    final settlement = _currentContract.settlement;
    final payUrl = ApiConfig.paymentCheckoutUrl(_currentContract.contractId);
    final receiptUrl = settlement != null && settlement.txSignature.isNotEmpty
        ? ApiConfig.verifiedReceiptUrl(settlement.txSignature)
        : payUrl;

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Contract Details'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: _isRefreshing
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.solanaGreen,
                    ),
                  )
                : const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Contract',
            onPressed: _isRefreshing ? null : _refreshContract,
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.solanaGreen,
          backgroundColor: AppColors.surface,
          onRefresh: _refreshContract,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 1. Header Card: Title, Client, Status & Amount
                _buildHeaderCard(isPaid),
                const SizedBox(height: 18),

                // 2. Action Button (Payment Link vs Verified Receipt)
                if (!isPaid)
                  _buildPendingPaymentActions(payUrl)
                else
                  _buildPaidReceiptActions(receiptUrl),
                const SizedBox(height: 24),

                // 3. Scope Description Section
                _buildScopeSection(),
                const SizedBox(height: 24),

                // 4. Cryptographic Proof & Verification
                _buildCryptographicSection(),
                const SizedBox(height: 24),

                // 5. Settlement / Devnet Status Card (if Paid)
                if (isPaid && settlement != null) ...[
                  _buildSettlementCard(settlement),
                  const SizedBox(height: 24),
                ],

                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeaderCard(bool isPaid) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  _currentContract.projectTitle,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.4,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isPaid
                      ? AppColors.solanaGreen.withValues(alpha: 0.15)
                      : AppColors.warningYellow.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isPaid
                        ? AppColors.solanaGreen.withValues(alpha: 0.4)
                        : AppColors.warningYellow.withValues(alpha: 0.4),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isPaid
                          ? Icons.check_circle_rounded
                          : Icons.hourglass_top_rounded,
                      size: 14,
                      color: isPaid
                          ? AppColors.solanaGreen
                          : AppColors.warningYellow,
                    ),
                    const SizedBox(width: 5),
                    Text(
                      isPaid ? 'PAID' : 'PENDING',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: isPaid
                            ? AppColors.solanaGreen
                            : AppColors.warningYellow,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              const Icon(Icons.business_rounded,
                  size: 16, color: AppColors.textSecondary),
              const SizedBox(width: 6),
              Text(
                'Client: ${_currentContract.clientName}',
                style: const TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: AppColors.surfaceBorder, height: 1),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Milestone Value',
                    style: TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Devnet Escrow',
                    style: TextStyle(
                      fontSize: 11,
                      color: AppColors.textMuted,
                    ),
                  ),
                ],
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    Formatters.formatCurrency(_currentContract.amount),
                    style: const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                      letterSpacing: -0.6,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _currentContract.tokenSymbol,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: AppColors.solanaGreen,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPendingPaymentActions(String payUrl) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.warningYellow.withValues(alpha: 0.35),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.payment_rounded,
                  color: AppColors.warningYellow, size: 20),
              SizedBox(width: 8),
              Text(
                'Client Payment Pending',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Share or open the secure FlowPact checkout link. The client signs on Solana Devnet to settle payment.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          // Primary Button: Open Client Payment Link
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => _launchExternalUrl(payUrl),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.solanaGreen,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.open_in_new_rounded, size: 18),
              label: const Text(
                'Open Client Payment Link',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          // Secondary Button: Copy Payment Link
          SizedBox(
            width: double.infinity,
            height: 42,
            child: OutlinedButton.icon(
              onPressed: () => _copyToClipboard(payUrl, 'Client payment link'),
              style: OutlinedButton.styleFrom(
                side: const BorderSide(color: AppColors.surfaceBorder),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.copy_rounded,
                  size: 16, color: AppColors.textSecondary),
              label: const Text(
                'Copy Payment Link',
                style: TextStyle(
                  color: AppColors.textSecondary,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaidReceiptActions(String receiptUrl) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.solanaGreen.withValues(alpha: 0.4),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.verified_rounded,
                  color: AppColors.solanaGreen, size: 20),
              SizedBox(width: 8),
              Text(
                'Payment Verified & Settled',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Cryptographic proof receipt is permanently anchored to Solana Devnet.',
            style: TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          // Primary Button: View Verified Receipt
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton.icon(
              onPressed: () => _launchExternalUrl(receiptUrl),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.solanaGreen,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              icon: const Icon(Icons.receipt_long_rounded, size: 18),
              label: const Text(
                'View Verified Receipt',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildScopeSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Milestone Scope & Deliverables',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            _currentContract.scopeDescription,
            style: const TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.55,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCryptographicSection() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.surfaceBorder, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.lock_clock_rounded,
                  size: 18, color: AppColors.solanaPurple),
              SizedBox(width: 8),
              Text(
                'Cryptographic Audit Info',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Contract ID', _currentContract.contractId),
          _buildInfoRow('Solana Reference Key', _currentContract.referencePublicKey),
          _buildInfoRow('Deterministic Contract Hash', _currentContract.contractHash),
          _buildInfoRow('Freelancer Recipient Wallet', _currentContract.freelancerWallet),
          _buildInfoRow('Creation Timestamp', Formatters.formatDateTime(_currentContract.createdAt)),
        ],
      ),
    );
  }

  Widget _buildSettlementCard(SettlementModel settlement) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.solanaGreen.withValues(alpha: 0.35),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.solanaGreen.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_rounded,
                    size: 16, color: AppColors.solanaGreen),
              ),
              const SizedBox(width: 10),
              const Text(
                'On-Chain Settlement Verification',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: AppColors.textPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow('Transaction Signature', settlement.txSignature),
          _buildInfoRow('Client Payer Wallet', settlement.payerWallet),
          _buildInfoRow('Settlement Slot', settlement.slot.toString()),
          _buildInfoRow(
            'Verified Timestamp',
            Formatters.formatDateTime(settlement.verifiedAt),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: AppColors.textMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Expanded(
                child: Text(
                  value,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                    fontFamily: 'monospace',
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              InkWell(
                onTap: () => _copyToClipboard(value, label),
                borderRadius: BorderRadius.circular(4),
                child: const Padding(
                  padding: EdgeInsets.all(4),
                  child: Icon(Icons.copy_rounded,
                      size: 14, color: AppColors.textMuted),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
