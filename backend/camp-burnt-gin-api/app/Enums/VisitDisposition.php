<?php

namespace App\Enums;

enum VisitDisposition: string
{
    case ReturnedToActivity = 'returned_to_activity';
    case Monitoring         = 'monitoring';
    case SentHome           = 'sent_home';
    case EmergencyTransfer  = 'emergency_transfer';
    case Other              = 'other';

    public function label(): string
    {
        return match($this) {
            self::ReturnedToActivity => 'Returned to Activity',
            self::Monitoring         => 'Monitoring in Health Office',
            self::SentHome           => 'Sent Home',
            self::EmergencyTransfer  => 'Emergency Transfer',
            self::Other              => 'Other',
        };
    }
}
