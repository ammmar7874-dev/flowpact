import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flowpact_mobile/main.dart';
import 'package:flowpact_mobile/core/constants/api_config.dart';
import 'package:flowpact_mobile/data/models/contract_model.dart';
import 'package:flowpact_mobile/data/services/api_service.dart';
import 'package:flowpact_mobile/providers/contract_provider.dart';
import 'package:flowpact_mobile/screens/contract_detail/contract_detail_screen.dart';

// Mock ApiService for deterministic, hermetic Flutter tests
class MockApiService implements ApiService {
  final List<ContractModel> mockContracts;
  bool shouldFail;

  MockApiService({
    required this.mockContracts,
    this.shouldFail = false,
  });

  @override
  Future<List<ContractModel>> getContracts() async {
    if (shouldFail) {
      throw Exception('Connection refused: server unreachable');
    }
    return List.from(mockContracts);
  }

  @override
  Future<ContractModel> getContractById(String contractId) async {
    if (shouldFail) {
      throw Exception('Failed to fetch contract');
    }
    return mockContracts.firstWhere((c) => c.contractId == contractId);
  }

  @override
  Future<ContractModel> createContract({
    required String projectTitle,
    required String scopeDescription,
    required String clientName,
    required double amount,
    required String freelancerWallet,
  }) async {
    if (shouldFail) {
      throw Exception('Validation error: invalid request');
    }
    final contract = ContractModel(
      contractId: 'fp_new_${DateTime.now().millisecondsSinceEpoch}',
      projectTitle: projectTitle,
      scopeDescription: scopeDescription,
      clientName: clientName,
      amount: amount,
      tokenSymbol: 'DUSD',
      tokenMint: 'ERnsPVfYhVPLxzYobSGAXuYnSW93SR92tJrmp55QP7KH',
      freelancerWallet: freelancerWallet,
      status: ContractStatus.pending,
      contractHash: 'mock_deterministic_hash_123',
      referencePublicKey: 'mock_reference_key_456',
      createdAt: DateTime.now(),
    );
    mockContracts.insert(0, contract);
    return contract;
  }
}

void main() {
  late List<ContractModel> demoContracts;

  setUp(() {
    demoContracts = [
      // 1. Confirmed / Paid Demo Contract (Live audited contract)
      ContractModel(
        contractId: 'fp_muzpxry5_41122c61',
        projectTitle: 'FlowPact Mobile Dashboard',
        scopeDescription:
            'Design and implement the Flutter dashboard, contract management interface, and responsive UI polish.',
        clientName: 'Demo Global Client',
        amount: 250.0,
        tokenSymbol: 'DUSD',
        tokenMint: 'ERnsPVfYhVPLxzYobSGAXuYnSW93SR92tJrmp55QP7KH',
        freelancerWallet: 'GtZfVRzNj5fb2tZ8wwNzFEuvXEGP4wGHQ2ccoPntWP1A',
        status: ContractStatus.confirmed,
        contractHash:
            '8bf324ca38cd3ccfd02a45e7e7f5e59237f2f421a93b4dda92809ed6df61c86d',
        referencePublicKey:
            'HAC5QRLKGNovmK5sE6Ucqc4vQbSMmE6nmnji9XzEkdMZ',
        createdAt: DateTime.parse('2026-10-08T15:56:02.762Z'),
        settlement: SettlementModel(
          txSignature:
              '3E5Bk2azq5LazNN7XasV2sGeJHfaZjj7NdiS7xKkGf5d6ufXkBWHNJTyJc1mhygJe7JoULSawwS9iyayo8R4Meu4',
          payerWallet: '2JRRVpQbzV3D4qdniTFXCw41dNQbWJTzPxXCriN2ihnv',
          recipientWallet: 'GtZfVRzNj5fb2tZ8wwNzFEuvXEGP4wGHQ2ccoPntWP1A',
          amount: 250.0,
          mint: 'ERnsPVfYhVPLxzYobSGAXuYnSW93SR92tJrmp55QP7KH',
          slot: 508886734,
          blockTime: 1791479212,
          verifiedAt: DateTime.parse('2026-10-08T17:06:55.975Z'),
          explorerUrl:
              'https://explorer.solana.com/tx/3E5Bk2azq5LazNN7XasV2sGeJHfaZjj7NdiS7xKkGf5d6ufXkBWHNJTyJc1mhygJe7JoULSawwS9iyayo8R4Meu4?cluster=devnet',
        ),
      ),
      // 2. Pending Contract
      ContractModel(
        contractId: 'fp_pending_milestone_77',
        projectTitle: 'Solana Mobile SDK Integration',
        scopeDescription: 'Implement secure client signature with MWA.',
        clientName: 'Alice Studio',
        amount: 500.0,
        tokenSymbol: 'DUSD',
        tokenMint: 'ERnsPVfYhVPLxzYobSGAXuYnSW93SR92tJrmp55QP7KH',
        freelancerWallet: 'GtZfVRzNj5fb2tZ8wwNzFEuvXEGP4wGHQ2ccoPntWP1A',
        status: ContractStatus.pending,
        contractHash: 'hash_pending_123',
        referencePublicKey: 'ref_pending_key_123',
        createdAt: DateTime.now().subtract(const Duration(hours: 5)),
      ),
    ];
  });

  group('Phase 2 API Configuration & URL Building Tests', () {
    test('ApiConfig produces correct emulator and web URLs', () {
      ApiConfig.setBaseUrl('http://10.0.2.2:3000');
      expect(ApiConfig.baseUrl, equals('http://10.0.2.2:3000'));
      expect(ApiConfig.contractsUrl, equals('http://10.0.2.2:3000/api/contracts'));
      expect(ApiConfig.createContractUrl, equals('http://10.0.2.2:3000/api/contracts/create'));
      expect(ApiConfig.contractDetailUrl('fp_123'), equals('http://10.0.2.2:3000/api/contracts/fp_123'));
      expect(ApiConfig.paymentCheckoutUrl('fp_123'), equals('http://10.0.2.2:3000/pay/fp_123'));
      expect(ApiConfig.verifiedReceiptUrl('sig_abc'), equals('http://10.0.2.2:3000/verify/sig_abc'));
    });
  });

  group('Phase 2 ContractProvider State & Metrics Tests', () {
    test('Calculates live dashboard metrics accurately from contracts', () async {
      final mockService = MockApiService(mockContracts: demoContracts);
      final provider = ContractProvider(apiService: mockService);

      await provider.fetchContracts();

      expect(provider.totalContracts, equals(2));
      expect(provider.paidContractsCount, equals(1));
      expect(provider.pendingContractsCount, equals(1));
      expect(provider.totalVerifiedIncome, equals(250.0));
      expect(provider.pendingIncome, equals(500.0));
      expect(provider.hasError, isFalse);
    });

    test('Handles API failure and updates error state gracefully', () async {
      final mockService = MockApiService(mockContracts: [], shouldFail: true);
      final provider = ContractProvider(apiService: mockService);

      await provider.fetchContracts();

      expect(provider.hasError, isTrue);
      expect(provider.errorMessage, contains('Connection refused'));
      expect(provider.totalContracts, equals(0));
    });

    test('Creates contract and prepends to dashboard list', () async {
      final mockService = MockApiService(mockContracts: demoContracts);
      final provider = ContractProvider(apiService: mockService);

      await provider.fetchContracts();
      expect(provider.totalContracts, equals(2));

      final created = await provider.createContract(
        projectTitle: 'Smart Contract Audit',
        scopeDescription: 'Security review of SPL token escrow',
        clientName: 'Grantee Foundation',
        amount: 300.0,
        freelancerWallet: 'GtZfVRzNj5fb2tZ8wwNzFEuvXEGP4wGHQ2ccoPntWP1A',
      );

      expect(created.projectTitle, equals('Smart Contract Audit'));
      expect(provider.totalContracts, equals(3));
      expect(provider.contracts.first.contractId, equals(created.contractId));
    });
  });

  group('Phase 2 UI Integration Tests', () {
    testWidgets('Dashboard renders live API metrics and contracts list',
        (WidgetTester tester) async {
      final mockService = MockApiService(mockContracts: demoContracts);
      final provider = ContractProvider(apiService: mockService);

      await tester.pumpWidget(FlowPactApp(contractProvider: provider));

      // Advance past splash
      await tester.pump(const Duration(milliseconds: 2800));
      await tester.pumpAndSettle();

      // Verify dashboard elements
      expect(find.text('Flow'), findsOneWidget);
      expect(find.text('Pact'), findsOneWidget);
      expect(find.text('Create Contract'), findsOneWidget);
      expect(find.text('Recent Contracts'), findsOneWidget);
      expect(find.text('FlowPact Mobile Dashboard'), findsOneWidget);
      expect(find.text('Solana Mobile SDK Integration'), findsOneWidget);
      expect(find.text('250.00 DUSD'), findsWidgets);
      expect(find.text('500.00 DUSD'), findsWidgets);
    });

    testWidgets('ContractDetail displays Open Client Payment Link on pending contracts',
        (WidgetTester tester) async {
      final pendingContract = demoContracts.firstWhere((c) => !c.isPaid);

      await tester.pumpWidget(
        MaterialApp(
          home: ContractDetailScreen(contract: pendingContract),
        ),
      );

      expect(find.text('Contract Details'), findsOneWidget);
      expect(find.text('PENDING'), findsOneWidget);
      expect(find.text('Open Client Payment Link'), findsOneWidget);
      expect(find.text('Copy Payment Link'), findsOneWidget);
      expect(find.text('Cryptographic Audit Info'), findsOneWidget);
    });

    testWidgets('ContractDetail displays View Verified Receipt on paid contracts',
        (WidgetTester tester) async {
      final paidContract = demoContracts.firstWhere((c) => c.isPaid);

      await tester.pumpWidget(
        MaterialApp(
          home: ContractDetailScreen(contract: paidContract),
        ),
      );

      expect(find.text('Contract Details'), findsOneWidget);
      expect(find.text('PAID'), findsOneWidget);
      expect(find.text('View Verified Receipt'), findsOneWidget);
      expect(find.text('On-Chain Settlement Verification'), findsOneWidget);
      expect(find.text('Transaction Signature'), findsOneWidget);
    });
  });
}
