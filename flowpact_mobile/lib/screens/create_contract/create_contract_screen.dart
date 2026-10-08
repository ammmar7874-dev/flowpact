import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/constants/app_constants.dart';
import '../../providers/contract_provider.dart';
import '../contract_detail/contract_detail_screen.dart';

class CreateContractScreen extends StatefulWidget {
  const CreateContractScreen({super.key});

  @override
  State<CreateContractScreen> createState() => _CreateContractScreenState();
}

class _CreateContractScreenState extends State<CreateContractScreen> {
  final _formKey = GlobalKey<FormState>();

  final _titleController = TextEditingController();
  final _scopeController = TextEditingController();
  final _clientController = TextEditingController();
  final _amountController = TextEditingController();
  final _walletController =
      TextEditingController(text: AppConstants.defaultFreelancerWallet);

  bool _isSubmitting = false;
  String? _submissionError;

  @override
  void dispose() {
    _titleController.dispose();
    _scopeController.dispose();
    _clientController.dispose();
    _amountController.dispose();
    _walletController.dispose();
    super.dispose();
  }

  Future<void> _submitContract() async {
    setState(() {
      _submissionError = null;
    });

    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isSubmitting = true;
    });

    try {
      final title = _titleController.text.trim();
      final scope = _scopeController.text.trim();
      final client = _clientController.text.trim();
      final amount = double.parse(_amountController.text.trim());
      final wallet = _walletController.text.trim();

      final provider = context.read<ContractProvider>();
      final newContract = await provider.createContract(
        projectTitle: title,
        scopeDescription: scope,
        clientName: client,
        amount: amount,
        freelancerWallet: wallet,
      );

      if (!mounted) return;

      // Show success feedback
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.surface,
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded,
                  color: AppColors.solanaGreen, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Contract ${newContract.contractId} created on FlowPact!',
                  style: const TextStyle(
                      color: AppColors.textPrimary, fontSize: 13),
                ),
              ),
            ],
          ),
          duration: const Duration(seconds: 4),
        ),
      );

      // Navigate to Contract Detail screen
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) => ContractDetailScreen(contract: newContract),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _submissionError = e.toString().replaceFirst('Exception: ', '');
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.errorRed,
          content: Text('Creation failed: $_submissionError'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Create Milestone Contract'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Info banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.solanaPurple.withValues(alpha: 0.3),
                      width: 1,
                    ),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.shield_outlined,
                          color: AppColors.solanaPurple, size: 20),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Server computes a deterministic SHA-256 hash & Devnet reference key on creation.',
                          style: TextStyle(
                            fontSize: 12,
                            color: AppColors.textSecondary,
                            height: 1.35,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                if (_submissionError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.errorRed.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppColors.errorRed.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: AppColors.errorRed, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _submissionError!,
                            style: const TextStyle(color: AppColors.errorRed, fontSize: 13),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                ],

                // 1. Project Title
                _buildFieldLabel('Project Title *'),
                TextFormField(
                  controller: _titleController,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'e.g. Flutter Mobile Client UI',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter a project title';
                    }
                    if (val.trim().length < 3) {
                      return 'Title must be at least 3 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                // 2. Scope Description
                _buildFieldLabel('Scope Description *'),
                TextFormField(
                  controller: _scopeController,
                  maxLines: 4,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'Define deliverables, acceptance criteria, and milestones...',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please provide a detailed scope description';
                    }
                    if (val.trim().length < 10) {
                      return 'Scope description must be at least 10 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                // 3. Client Name
                _buildFieldLabel('Client Name *'),
                TextFormField(
                  controller: _clientController,
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: const InputDecoration(
                    hintText: 'e.g. Superteam Earn / Acme Corp',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter client name';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                // 4. Amount in DUSD
                _buildFieldLabel('Amount (DUSD) *'),
                TextFormField(
                  controller: _amountController,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  ],
                  style: const TextStyle(color: AppColors.textPrimary),
                  decoration: InputDecoration(
                    hintText: 'e.g. 250.00',
                    suffixIcon: Padding(
                      padding: const EdgeInsets.only(right: 14),
                      child: Center(
                        widthFactor: 0.0,
                        child: Text(
                          AppConstants.tokenSymbol,
                          style: const TextStyle(
                            color: AppColors.solanaGreen,
                            fontWeight: FontWeight.w700,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    ),
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please enter milestone payment amount';
                    }
                    final parsed = double.tryParse(val.trim());
                    if (parsed == null || parsed <= 0) {
                      return 'Amount must be greater than 0';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 20),

                // 5. Freelancer Solana Wallet
                _buildFieldLabel('Freelancer Solana Wallet *'),
                TextFormField(
                  controller: _walletController,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 13,
                    fontFamily: 'monospace',
                  ),
                  decoration: const InputDecoration(
                    hintText: 'Base58 Solana recipient public key',
                  ),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return 'Please provide a Solana recipient wallet';
                    }
                    final trimmed = val.trim();
                    if (trimmed.length < 32 || trimmed.length > 44) {
                      return 'Invalid Solana public key length (32-44 base58 chars)';
                    }
                    final base58Regex = RegExp(r'^[1-9A-HJ-NP-Za-km-z]+$');
                    if (!base58Regex.hasMatch(trimmed)) {
                      return 'Wallet contains invalid Base58 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 32),

                // Submit Button
                Container(
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
                        color: AppColors.solanaGreen.withValues(alpha: 0.25),
                        blurRadius: 18,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitContract,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.transparent,
                      shadowColor: Colors.transparent,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                              strokeWidth: 2.5,
                              valueColor:
                                  AlwaysStoppedAnimation<Color>(Colors.black),
                            ),
                          )
                        : const Text(
                            'Create Milestone Contract',
                            style: TextStyle(
                              color: Colors.black,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              letterSpacing: -0.2,
                            ),
                          ),
                  ),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFieldLabel(String label) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w600,
          color: AppColors.textSecondary,
        ),
      ),
    );
  }
}
