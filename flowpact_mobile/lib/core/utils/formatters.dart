import 'package:intl/intl.dart';

class Formatters {
  Formatters._();

  static String formatCurrency(double amount) {
    final formatter = NumberFormat("#,##0.00", "en_US");
    return formatter.format(amount);
  }

  static String formatWallet(String address, {int head = 4, int tail = 4}) {
    if (address.length <= head + tail) return address;
    return '${address.substring(0, head)}...${address.substring(address.length - tail)}';
  }

  static String formatDate(DateTime date) {
    return DateFormat('MMM d, yyyy • HH:mm').format(date);
  }

  static String formatDateTime(DateTime date) {
    return DateFormat('MMM d, yyyy • HH:mm').format(date);
  }
}
