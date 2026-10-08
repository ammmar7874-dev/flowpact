import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/constants/app_constants.dart';
import '../../core/utils/formatters.dart';
import '../../data/models/contract_model.dart';
import '../../providers/contract_provider.dart';
import 'widgets/metric_card.dart';
import 'widgets/contract_card.dart';
import '../create_contract/create_contract_screen.dart';
import '../contract_detail/contract_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedFilterIndex = 0; // 0: All, 1: Pending, 2: Paid

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ContractProvider>().fetchContracts();
    });
  }

  @override
  Widget build(BuildContext context) {
    final contractProvider = context.watch<ContractProvider>();
    final allContracts = contractProvider.contracts;

    final filteredContracts = allContracts.where((c) {
      if (_selectedFilterIndex == 1) return c.status == ContractStatus.pending;
      if (_selectedFilterIndex == 2) return c.status == ContractStatus.confirmed;
      return true;
    }).toList();

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.solanaGreen,
          backgroundColor: AppColors.surface,
          onRefresh: () async {
            await context.read<ContractProvider>().fetchContracts(silent: true);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                _buildHeader(context),
                const SizedBox(height: 24),

                // Metrics Grid (Responsive 2x2 with Live API Data)
                _buildMetricsGrid(contractProvider),
                const SizedBox(height: 24),

                // Primary CTA: Create Contract
                _buildCreateContractButton(context),
                const SizedBox(height: 28),

                // Section Header & Filter Tabs
                _buildSectionHeader(),
                const SizedBox(height: 14),

                _buildFilterTabs(contractProvider),
                const SizedBox(height: 16),

                // Content / Error / Loading States
                if (contractProvider.isLoading && allContracts.isEmpty)
                  _buildLoadingState()
                else if (contractProvider.hasError && allContracts.isEmpty)
                  _buildErrorState(contractProvider)
                else if (filteredContracts.isEmpty)
                  _buildEmptyState()
                else
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: filteredContracts.length,
                    itemBuilder: (context, index) {
                      final contract = filteredContracts[index];
                      return ContractCard(
                        contract: contract,
                        onTap: () async {
                          await Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) =>
                                  ContractDetailScreen(contract: contract),
                            ),
                          );
                        },
                      );
                    },
                  ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text(
                  'Flow',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
                Text(
                  'Pact',
                  style: TextStyle(
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    color: AppColors.solanaGreen,
                    letterSpacing: -0.5,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Freelancer: ${Formatters.formatWallet(AppConstants.defaultFreelancerWallet)}',
              style: const TextStyle(
                fontSize: 12,
                color: AppColors.textSecondary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        // Devnet live badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.surfaceBorder, width: 1),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 7,
                height: 7,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.solanaGreen,
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                'Devnet',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMetricsGrid(ContractProvider provider) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cardWidth = (constraints.maxWidth - 12) / 2;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            SizedBox(
              width: cardWidth,
              height: 112,
              child: MetricCard(
                label: 'Verified Income',
                value: '${Formatters.formatCurrency(provider.totalVerifiedIncome)} DUSD',
                subtitle: 'On-chain settled',
                icon: Icons.account_balance_wallet_rounded,
                accentColor: AppColors.solanaGreen,
              ),
            ),
            SizedBox(
              width: cardWidth,
              height: 112,
              child: MetricCard(
                label: 'Pending Payments',
                value: '${Formatters.formatCurrency(provider.pendingIncome)} DUSD',
                subtitle: 'Awaiting client',
                icon: Icons.hourglass_top_rounded,
                accentColor: AppColors.warningYellow,
              ),
            ),
            SizedBox(
              width: cardWidth,
              height: 112,
              child: MetricCard(
                label: 'Paid Contracts',
                value: '${provider.paidContractsCount}',
                subtitle: 'Cryptographic proof',
                icon: Icons.task_alt_rounded,
                accentColor: AppColors.solanaPurple,
              ),
            ),
            SizedBox(
              width: cardWidth,
              height: 112,
              child: MetricCard(
                label: 'Total Contracts',
                value: '${provider.totalContracts}',
                subtitle: 'Milestone escrow',
                icon: Icons.description_rounded,
                accentColor: AppColors.solanaGreen,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildCreateContractButton(BuildContext context) {
    return Container(
      width: double.infinity,
      height: 52,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(14),
        gradient: const LinearGradient(
          colors: [
            Color(0xFF14F195),
            Color(0xFF00C782),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.solanaGreen.withValues(alpha: 0.28),
            blurRadius: 18,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ElevatedButton(
        onPressed: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const CreateContractScreen(),
            ),
          );
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.transparent,
          shadowColor: Colors.transparent,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.add_rounded, size: 22, color: Colors.black),
            SizedBox(width: 8),
            Text(
              'Create Contract',
              style: TextStyle(
                color: Colors.black,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionHeader() {
    return const Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          'Recent Contracts',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: AppColors.textPrimary,
            letterSpacing: -0.3,
          ),
        ),
      ],
    );
  }

  Widget _buildFilterTabs(ContractProvider provider) {
    final filters = [
      'All (${provider.totalContracts})',
      'Pending (${provider.pendingContractsCount})',
      'Paid (${provider.paidContractsCount})',
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(filters.length, (index) {
          final isSelected = _selectedFilterIndex == index;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () {
                setState(() {
                  _selectedFilterIndex = index;
                });
              },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.surfaceSubtle : AppColors.surface,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected
                        ? AppColors.solanaGreen
                        : AppColors.surfaceBorder,
                    width: 1,
                  ),
                ),
                child: Text(
                  filters[index],
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.w400,
                    color: isSelected
                        ? AppColors.solanaGreen
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildLoadingState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder, width: 1),
      ),
      child: const Column(
        children: [
          CircularProgressIndicator(color: AppColors.solanaGreen, strokeWidth: 2.5),
          SizedBox(height: 16),
          Text(
            'Syncing FlowPact contracts...',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(ContractProvider provider) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.4), width: 1),
      ),
      child: Column(
        children: [
          const Icon(Icons.cloud_off_rounded, color: AppColors.errorRed, size: 36),
          const SizedBox(height: 12),
          const Text(
            'Unable to reach FlowPact server',
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            provider.errorMessage ?? 'Please check your connection and try again.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 12,
            ),
          ),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: () => provider.fetchContracts(),
            style: OutlinedButton.styleFrom(
              side: const BorderSide(color: AppColors.solanaGreen),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.refresh_rounded, color: AppColors.solanaGreen, size: 16),
            label: const Text(
              'Retry Connection',
              style: TextStyle(color: AppColors.solanaGreen, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder, width: 1),
      ),
      child: Column(
        children: [
          Icon(
            Icons.inbox_rounded,
            size: 40,
            color: AppColors.textMuted.withValues(alpha: 0.7),
          ),
          const SizedBox(height: 12),
          const Text(
            'No contracts found in this category',
            style: TextStyle(
              color: AppColors.textSecondary,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
