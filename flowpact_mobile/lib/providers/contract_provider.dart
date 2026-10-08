import 'dart:collection';
import 'package:flutter/foundation.dart';
import '../data/models/contract_model.dart';
import '../data/services/api_service.dart';
import '../data/services/http_api_service.dart';

class ContractProvider extends ChangeNotifier {
  final ApiService _apiService;
  final List<ContractModel> _contracts = [];
  bool _isLoading = false;
  String? _errorMessage;
  bool _initialLoadDone = false;

  ContractProvider({ApiService? apiService})
      : _apiService = apiService ?? HttpApiService();

  UnmodifiableListView<ContractModel> get contracts => UnmodifiableListView(_contracts);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasError => _errorMessage != null;
  bool get initialLoadDone => _initialLoadDone;

  int get totalContracts => _contracts.length;

  int get paidContractsCount =>
      _contracts.where((c) => c.status == ContractStatus.confirmed).length;

  int get pendingContractsCount =>
      _contracts.where((c) => c.status == ContractStatus.pending).length;

  double get totalVerifiedIncome => _contracts
      .where((c) => c.status == ContractStatus.confirmed)
      .fold(0.0, (acc, c) => acc + c.amount);

  double get pendingIncome => _contracts
      .where((c) => c.status == ContractStatus.pending)
      .fold(0.0, (acc, c) => acc + c.amount);

  Future<void> fetchContracts({bool silent = false}) async {
    if (!silent) {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();
    }

    try {
      final fetched = await _apiService.getContracts();
      _contracts.clear();
      _contracts.addAll(fetched);
      _errorMessage = null;
    } catch (e) {
      _errorMessage = e.toString().replaceFirst('Exception: ', '');
    } finally {
      _isLoading = false;
      _initialLoadDone = true;
      notifyListeners();
    }
  }

  Future<ContractModel?> fetchContractById(String contractId) async {
    try {
      final updated = await _apiService.getContractById(contractId);
      final index = _contracts.indexWhere((c) => c.contractId == contractId);
      if (index != -1) {
        _contracts[index] = updated;
      } else {
        _contracts.insert(0, updated);
      }
      notifyListeners();
      return updated;
    } catch (_) {
      return null;
    }
  }

  Future<ContractModel> createContract({
    required String projectTitle,
    required String scopeDescription,
    required String clientName,
    required double amount,
    required String freelancerWallet,
  }) async {
    final contract = await _apiService.createContract(
      projectTitle: projectTitle,
      scopeDescription: scopeDescription,
      clientName: clientName,
      amount: amount,
      freelancerWallet: freelancerWallet,
    );

    _contracts.removeWhere((c) => c.contractId == contract.contractId);
    _contracts.insert(0, contract);
    notifyListeners();

    return contract;
  }
}
